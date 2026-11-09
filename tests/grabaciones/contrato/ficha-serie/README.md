# [Grabaciones][contrato] GET nsh/unified-detailed/{pid} · serie grabada (RSR)

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76692 |
| Tipo | Contrato |
| Componente | Grabaciones |
| Versión base | 26.10.100 |

## Qué hace
Valida que la ficha de una serie grabada (`unified-detailed/RSR…_LCH…`) cumple su propio esquema: es un árbol de grabaciones (seasons RSE con episodios REC), con una forma distinta a la ficha de contenido, así que tiene contrato aparte (`GET__nsh_unified-detailed_pid~RSR.json`). Campo que falta o cambia de tipo → fallo; campo nuevo → aviso.

## Endpoints afectados
- `GET nsh/unified-detailed/{pid}` (pids RSR…)

## Pantallas / funcionalidad afectada
- Mein TV > Verfügbare / Geplante Aufnahmen > ficha de serie grabada.

## Precondiciones
- Cuenta O2 DE válida en `.env` con alguna serie grabada; sesión y captura en vivo automáticas (journeys `detail-recording-serie`, `detail-recording-scheduled`).

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.
- Contrato inferido de la captura en vivo del 2026-11-09 (`npm run contracts:from-live`).

## Resultado esperado
- Respuesta 2xx y cuerpo conforme al contrato `contracts/26.10.100/GET__nsh_unified-detailed_pid~RSR.json`.

## Cómo ejecutar
```
npx playwright test tests/grabaciones/contrato/ficha-serie
```
