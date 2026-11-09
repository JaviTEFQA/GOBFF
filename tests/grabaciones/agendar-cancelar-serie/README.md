# [API][canoway][mutación] Grabar una serie entera y cancelarla

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76698 |
| Tipo | API · mutación (escritura) |
| Prioridad | Alta |
| Versión base | 26.10.100 |

## Qué hace
Prueba de escritura real contra el BFF, guiada por UI (la app firma la llamada). Desde la ficha de una serie en directo pulsa *Aufnehmen → Serie aufnehmen*, verifica que en `nsh/recordings` aparece una RSR nueva con sus REC marcados `isEntireSeries=true` y **cancela la serie entera** al terminar. Patrón hacer → verificar → deshacer: si el cancelado falla, la prueba falla y lista lo que quedó.

Automatiza MULTISTC-67784 (agendar serie: `entireSeries=true`, `entireSeason=false`) y MULTISTC-67787 (cancelar vía pid de la RSR) de GO-36303.

## Endpoints afectados
- `POST nsh/recordings` (agendar serie)
- `GET nsh/recordings` (verificación)
- `DELETE nsh/recordings/{RSR…|REC…}` (cancelar la serie)

## Pantallas / funcionalidad afectada
- Ficha de serie en directo (botón Aufnehmen, diálogo *Episode aufnehmen / Serie aufnehmen*) y Mein TV · Geplante Aufnahmen.

## Precondiciones
- `API_ALLOW_MUTATIONS=true` (si no, se omite).
- Sesión guardada (proyecto `auth`).
- **Espacio de grabación libre**. Con la cuota llena el BFF responde `420 RecordingSubscriberQuotaExceeded` y la prueba se omite indicando el motivo.
- Una serie en directo en *TV-Programm > Jetzt* que se pueda grabar y que la cuenta no esté grabando ya.
- La temporada (MULTISTC-67776, 67779) no se puede probar desde la web DE: el KV `ALLOWED_RECORDING_LEVELS` tiene `season=false` y la ficha no ofrece *Staffel aufnehmen*.

## Datos y mocks
- Sin mocks: escritura real en prod. La prueba crea y cancela su propia serie; no toca las grabaciones que ya tenía la cuenta.

## Resultado esperado
- El agendado responde 2xx y aparece exactamente una RSR nueva con REC `isEntireSeries=true`.
- El cancelado responde 2xx y no queda ningún REC de esa RSR.

## Cómo ejecutar
```
API_ALLOW_MUTATIONS=true npx playwright test --project=mutations tests/grabaciones/agendar-cancelar-serie
```
