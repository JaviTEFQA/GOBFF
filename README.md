# canoway BFF — framework de regresión de API

Framework de regresión del BFF **canoway** (`canoway-de.cdn.telefonica.com/instance/45/service`), el que usa la web de O2 TV DE. Versión base: **26.10.100**.

## Por qué funciona así: la firma por petición

canoway exige en cada llamada una cabecera `authorization: OP Bearer=<jwt>, Signature=<firma>`. La **firma cambia en cada petición**, va **atada a la URL exacta** y **caduca en segundos**; la calcula el cliente HTTP interno de la app (código ofuscado). Por eso **no se pueden reenviar peticiones a mano** (dan 401) ni firmarlas nosotros.

La solución: que **firme la app**. Un navegador logado recorre la web, la propia app pide los datos firmados y **capturamos sus respuestas reales** (`.live/<versión>/capture.json`, efímero). Las pruebas validan esa captura contra un **contrato guardado**. No se reimplementa la firma.

```
web 26.10 (logada) ──live-capture──▶ .live/<versión>/capture.json   (respuestas reales, efímero)
                                      │
                    ┌─────────────────┼──────────────────────┐
                    ▼                 ▼                        ▼
         contracts/<versión>/   tests/<componente>/…       mocks (page.route)
         (contrato inferido      contrato · negocio ·      tests/ui-mocked/…
          al grabar)             seguridad · mutación      (fechas desplazadas a "ahora")
```

## Organización: por componente

Las pruebas se organizan **por componente del producto**, no por tipo abstracto:

```
tests/
  perfiles/     contrato · integridad · sin-token
  home/         contrato · secciones · top10 · paginacion
  fichas/       contrato · propio-contenido · comercializacion
  grabaciones/  contrato · almacenamiento · sin-token · agendar-cancelar
  menu/ · ajustes/ · canales/ · reproduccion/ · homezone/ · arranque/
  ui-mocked/    regresión de la web con canoway mockeado
  unit/         autotest del framework (offline)
```

Cada carpeta: **un test + un README** (lo exige el autotest `readme-audit`). El tipo de prueba vive como etiqueta: `@contrato`, `@negocio`, `@seguridad`, `@mutation`.

## Tipos de prueba

| Tipo | Qué valida | Contra |
|---|---|---|
| Contrato | La respuesta cumple el esquema guardado | BFF real |
| Negocio | Reglas de las historias (un perfil por defecto, Top10 ≤10…) | BFF real |
| Seguridad | Rechaza llamadas sin token (401/403) | BFF real |
| Mutación | Escritura: hacer → verificar → deshacer | BFF (apagado) |
| ui-mocked | La web reacciona bien a respuestas mockeadas | Web + mock |
| Unit | El propio framework (esquema, redacción, audit) | Local |

## Contratos y versionado

El esquema de cada endpoint se **infiere al grabar** y se versiona en `contracts/<versión>/`. En cada ejecución se compara la respuesta viva contra ese esquema:

- **campo que falta o cambia de tipo → FALLO**
- **campo nuevo → aviso** (no rompe)

El contrato es una **línea base congelada**: no se actualiza solo. Solo cambia cuando regrabas (`npm run record`) y commiteas el nuevo, revisando antes el diff.

### Lo primero al llegar una versión nueva: comprobar contra la anterior

Cuando sale una versión nueva, **lo primero es ver que no rompe el contrato de la anterior**. Se captura con la versión nueva pero se valida contra el contrato de la previa:

```bash
# en .env (o como variables de entorno):
APP_VERSION=26.11.100          # captura la web de la versión nueva
CONTRACT_BASELINE=26.10.100    # pero valida contra el contrato de la anterior
npm run test:api
```

- Todo verde → la versión nueva **no rompe** la anterior (como mucho añade campos).
- Fallos → cambios que rompen; hay que decidir si son intencionados.
- `npm run contracts:diff` muestra exactamente qué cambió entre dos versiones.

Una vez revisado, se graba la foto nueva (`contracts/26.11.100/`) como nueva línea base, y la anterior se queda para su versión.

## Puesta en marcha

```bash
npm install
npx playwright install chromium
cp .env.example .env        # o usa ../ai-playwright-agent/.env

npm run test:unit           # autotest del framework (offline)
npm run test:api            # captura en vivo + contrato + negocio + seguridad contra el BFF real
```

Comandos útiles:

```bash
npm run record              # regraba todas las llamadas y reconstruye contratos
npm run live                # fuerza una captura en vivo nueva (.live/)
npm run contracts:diff      # compara contratos entre versiones
npm run scaffold            # crea prueba + README por endpoint nuevo
npm run synthetic           # comprueba las reglas con datos que la cuenta no tiene (captura sintética OK/KO)
```

`npm run synthetic` no valida el BFF: genera a partir de la captura real una versión con los casos
que faltan en la cuenta (perfil infantil, adultos, deportes, LSE/AD, widget 63, estados de
contratación) y otra con un defecto en cada uno, y comprueba que las pruebas pasan con la primera y
fallan con la segunda. Cualquier prueba puede leer otra captura con `LIVE_CAPTURE_FILE=<fichero>`.

Mutaciones (escritura real; apagadas por defecto, deshacen lo que hacen):

```bash
API_ALLOW_MUTATIONS=true npx playwright test --project=mutations
```

## Espejo en Python

`python/` reproduce la validación (contrato, negocio, seguridad) sobre **la misma captura** `.live/<versión>/capture.json`. No abre navegador: lee lo que capturó el framework TS.

```bash
cd python && pip install -r requirements.txt && pytest -q
```

## Trazabilidad con Jira

Cada prueba se liga a su Test Case (MULTISTC) y a su historia (GO):
- el nombre del test empieza por `[MULTISTC-xxxxx]`,
- el README lleva los campos `Jira` e `Historia`,
- el TC en MULTISTC lleva de prefijo el id del test automatizado.

## Seguridad

- Credenciales en `.env` (gitignored); nunca en URLs ni logs.
- Las grabaciones se redactan (tokens y cToken de DRM fuera) antes de guardarse.
- Nunca se reproducen mutaciones contra prod (`API_ALLOW_MUTATIONS=false` por defecto).
- La captura reutiliza la sesión guardada; no hace login en bucle (el SSO de O2 bloquea la cuenta).
