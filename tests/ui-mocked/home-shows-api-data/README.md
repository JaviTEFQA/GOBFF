# [WEB][mock canoway] La home pinta los datos que devuelve canoway

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76664 |
| Tipo | UI · regresión con mocks |
| Prioridad | Alta (smoke) |
| Versión base | 26.10.100 |

## Qué hace
Abre la web con canoway servido desde las grabaciones de la 26.10.100. Antes, cambia el título de todos los contenidos de `nsh/thematic-site-page-prio` por un marcador (`QA-MOCK-n`) y comprueba que la web pinta ese marcador. Así se demuestra que la home se construye con lo que devuelve el BFF, sin depender del catálogo real del día.

## Endpoints afectados
- `GET nsh/thematic-site-page-prio` (respuesta grabada y parcheada)
- Resto de llamadas a canoway: respuestas grabadas, o el backend real si no hay grabación

## Pantallas / funcionalidad afectada
- Home: carruseles y cards (título).

## Precondiciones
- Sesión web válida (proyecto `auth`, automático).
- Grabaciones de la 26.10.100 presentes (`npm run record`).

## Datos y mocks
- `nsh/thematic-site-page-prio` grabado, con fechas desplazadas a la hora de ejecución y títulos sustituidos por `QA-MOCK-n`.
- En el informe se adjuntan `canoway-mocked-calls.json` (qué se sirvió desde mock y qué se dejó pasar al backend real) y este README.

## Resultado esperado
- Se ve la cabecera de la app.
- La web llama a `nsh/thematic-site-page-prio`.
- Al menos una card muestra un título `QA-MOCK-n` (como texto, alt, aria-label o title).
- No hay errores JS no capturados.

## Cómo ejecutar
```
npx playwright test tests/ui-mocked/home-shows-api-data
```
