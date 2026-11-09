/**
 * scripts/scaffold-tests.ts — Create one independent contract test (+ README) per recorded endpoint.
 *
 *   npm run scaffold                 # current APP_VERSION
 *   npm run scaffold -- 26.11.100
 *
 * Creates tests/api/contract/<endpoint-slug>/{contract.spec.ts, README.md}.
 * Existing folders are NEVER overwritten (READMEs are edited by hand: Jira key,
 * notes…). Endpoints that disappeared from the inventory are listed, not deleted.
 */
import * as fs from 'fs';
import * as path from 'path';
import { env, paths, ROOT } from '../src/config/env';
import { SAFE_METHODS } from '../src/catalog/endpoint-id';
import { SCREEN_BY_JOURNEY } from '../src/recordings/journeys';
import type { InventoryEntry } from '../src/recordings/store';
import { renderReadme } from '../src/testing/readme';

const version = process.argv[2] ?? env.appVersion;
const invFile = path.join(paths.recordings(version), 'inventory.json');
if (!fs.existsSync(invFile)) {
  console.error(`No inventory for ${version}. Run "npm run record" first.`);
  process.exit(1);
}
const inventory = JSON.parse(fs.readFileSync(invFile, 'utf8')) as InventoryEntry[];
const baseDir = path.join(ROOT, 'tests', 'api', 'contract');

/** Endpoints the app cannot work without: tagged @smoke. */
const SMOKE = [/nsh\/home$/, /nsh\/thematic-site-page-prio$/, /nsh\/channels\/userOrder$/, /nsh\/menu$/, /nsh\/profiles$/, /directory\/getConfig$/, /unified-detailed-content\/\{pid\}$/, /nsh\/settings$/];

let created = 0;
for (const e of inventory) {
  const dir = path.join(baseDir, e.slug);
  if (fs.existsSync(dir)) continue;
  fs.mkdirSync(dir, { recursive: true });
  const smoke = SMOKE.some((re) => re.test(e.endpointId));
  const mutation = !SAFE_METHODS.has(e.method);

  fs.writeFileSync(
    path.join(dir, 'contract.spec.ts'),
    `import { defineContractTest } from '../../../../src/testing/contract-test';\n\ndefineContractTest('${e.endpointId}'${smoke ? ', { smoke: true }' : ''});\n`,
  );

  fs.writeFileSync(
    path.join(dir, 'README.md'),
    renderReadme({
      title: `[API][canoway] Contrato ${e.endpointId}`,
      type: 'API · regresión de contrato',
      priority: smoke ? 'Alta (smoke)' : 'Media',
      version,
      queHace:
        `Reproduce contra canoway real las peticiones que la web ${version} hace a \`${e.endpointId}\` ` +
        `(grabadas en \`recordings/${version}/${e.slug}/\`) y comprueba que la respuesta sigue cumpliendo el contrato ` +
        `inferido de esa versión: mismos campos obligatorios y mismos tipos. Detecta regresiones del BFF que romperían la app ` +
        `(campo eliminado, tipo cambiado, error 4xx/5xx) antes de que lleguen a la UI.`,
      endpoints: [e.endpointId, `Ejemplo: ${e.exampleUrl.replace(/\?.*$/, '')}`],
      pantallas: e.journeys.map((j) => SCREEN_BY_JOURNEY[j] ?? j),
      precondiciones: [
        'Cuenta O2 DE válida en `.env` (O2_LOGIN / O2_PASSWORD); el token se obtiene solo (proyecto `auth`).',
        `Grabaciones y contrato de ${version} presentes (\`npm run record\`).`,
        ...(mutation ? ['Es una operación de escritura: solo se ejecuta con `API_ALLOW_MUTATIONS=true`.'] : []),
      ],
      datos: [
        `Peticiones reales grabadas: ${e.samples} muestra(s), status grabados ${e.statuses.join(', ')}.`,
        'Si un PID grabado ya no existe (404/410) se sustituye por uno vivo del mismo tipo obtenido de `nsh/home` (se anota en el informe).',
        `Contrato: \`contracts/${version}/${e.slug}.json\`; relajaciones en \`contracts/overrides.json\`.`,
        'No usa mocks: valida el backend real.',
      ],
      resultado: [
        'Status 2xx.',
        'Ningún campo obligatorio ausente ni con tipo distinto al contrato (campos nuevos solo se anotan).',
        `Latencia ≤ API_LATENCY_BUDGET_MS (${env.latencyBudgetMs} ms por defecto; aviso, no bloqueante).`,
      ],
      comando: `npx playwright test tests/api/contract/${e.slug}`,
    }),
  );
  created++;
}

const known = new Set(inventory.map((e) => e.slug));
const orphan = fs.existsSync(baseDir) ? fs.readdirSync(baseDir).filter((d) => !known.has(d)) : [];
console.log(`[scaffold] ${created} new test folder(s) in tests/api/contract (${inventory.length} endpoints in ${version}).`);
if (orphan.length) console.log(`[scaffold] endpoints no longer called by the app in ${version}:\n  - ${orphan.join('\n  - ')}`);
