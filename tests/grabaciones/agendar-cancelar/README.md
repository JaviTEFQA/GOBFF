# [API][canoway][mutación] Agendar y cancelar una grabación

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76659 |
| Tipo | API · mutación (escritura) |
| Prioridad | Alta |
| Versión base | 26.10.100 |

## Qué hace
Prueba de escritura real contra el BFF, guiada por UI (la app firma la llamada). Agenda una grabación de un directo, verifica que aparece en `nsh/recordings` y la **cancela** al terminar. Patrón hacer → verificar → deshacer: si el cancelado falla, la prueba falla (no deja una grabación agendada en prod).

## Endpoints afectados
- Agendado de grabación (POST, familia `recordings`)
- `GET nsh/recordings` (verificación)
- Cancelado de grabación (POST, familia `recordings`)

## Pantallas / funcionalidad afectada
- Ficha de directo (botón Aufnehmen) y Mein TV · Grabaciones.

## Precondiciones
- `API_ALLOW_MUTATIONS=true` (si no, se omite).
- Cuenta O2 DE válida en `.env`; sesión automática (proyecto `auth`).
- **Espacio de grabación libre** en la cuenta. Con la cuota llena el BFF responde `420 RecordingSubscriberQuotaExceeded` (230118) y la prueba se omite indicando el motivo.
- Al agendar sale el diálogo *Episode aufnehmen / Serie aufnehmen*: la prueba elige siempre **Episode** (nunca la serie).
- Al cancelar sale *Möchtest du diese Aufnahme abbrechen?* con *[Zurück] [Aufnahme abbrechen]*: se confirma dentro del diálogo.
- Llamadas reales: agendar = `POST nsh/recordings` (`{liveSchedulePid, entireSeries:false}`), cancelar = `DELETE nsh/recordings/{REC…}`.
- Verificación por diferencia de PIDs (foto antes/después de `nsh/recordings`), no por "hay alguna": la cuenta ya tiene cientos de grabaciones agendadas.
- Primera ejecución recomendada con navegador visible (`MUTATIONS_HEADLESS` sin poner) para fijar selectores.

## Datos y mocks
- Sin mocks: escritura real en prod. La prueba crea y elimina su propio dato; no toca grabaciones preexistentes.

## Resultado esperado
- El agendado responde 2xx y la grabación aparece en `recordings`.
- El cancelado responde 2xx y deja la lista como estaba.

## Cómo ejecutar
```
API_ALLOW_MUTATIONS=true npx playwright test --project=mutations tests/grabaciones/agendar-cancelar
```
