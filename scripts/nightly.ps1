# scripts/nightly.ps1 — Tanda programada del framework BFF.
#
# 1. unit + api (captura en vivo nueva + contrato + negocio + seguridad)
# 2. ui-mocked (la web contra canoway servido desde grabaciones)
# 3. mutaciones (escritura real que se deshace), salvo -SinMutaciones
# 4. publica en Jira una "Test Case Execution" por TC (si hay JIRA_URL y JIRA_PAT en .env;
#    si no, solo deja el plan en el log)
#
# Resultados en reports/<fecha>/ (api.json, ui.json, mutations.json, nightly.log). Nunca reintenta
# el login: si la sesión de O2 no vale, la tanda falla una vez y lo deja en el log (riesgo de bloqueo SSO).
#
# Uso:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\nightly.ps1 [-SinMutaciones] [-SinPublicar]
param([switch]$SinMutaciones, [switch]$SinPublicar)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$day = Get-Date -Format 'yyyy-MM-dd'
$dir = Join-Path $root "reports\$day"
New-Item -ItemType Directory -Force $dir | Out-Null
$log = Join-Path $dir 'nightly.log'
function Log($m) { "$(Get-Date -Format 'HH:mm:ss') $m" | Tee-Object -FilePath $log -Append }

function Run($name, $projects, $extraEnv) {
  Log "== $name"
  foreach ($k in $extraEnv.Keys) { Set-Item "env:$k" $extraEnv[$k] }
  $pwArgs = @('playwright', 'test') + ($projects | ForEach-Object { "--project=$_" }) + @('--reporter=list,json')
  $env:PLAYWRIGHT_JSON_OUTPUT_NAME = Join-Path $dir "$name.json"
  & npx @pwArgs *>> $log
  $code = $LASTEXITCODE
  foreach ($k in $extraEnv.Keys) { Remove-Item "env:$k" -ErrorAction SilentlyContinue }
  Log "   $name terminado (código $code)"
  return $code
}

Log "Tanda $day en $root"
Run 'api' @('unit', 'api') @{ LIVE_CAPTURE_FORCE = 'true' } | Out-Null
Run 'ui' @('ui-mocked') @{} | Out-Null
if (-not $SinMutaciones) {
  Run 'mutations' @('mutations') @{ API_ALLOW_MUTATIONS = 'true'; MUTATIONS_HEADLESS = 'true' } | Out-Null
}

$results = Get-ChildItem $dir -Filter '*.json' | Where-Object { $_.Name -notlike 'jira-*' } | ForEach-Object { $_.FullName }
$publish = if ($SinPublicar) { @() } else { @('--publish') }
Log '== Jira'
& npx tsx scripts/publish-jira.ts @results @publish *>> $log
Log "Fin (log: $log)"
