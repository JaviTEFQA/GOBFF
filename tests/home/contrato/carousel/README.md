# [Home][contrato] POST nsh/carousel

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76660 |
| Tipo | Contrato |
| Componente | Home |
| Versión base | 26.10.100 |

## Qué hace
Valida que la respuesta real de `POST nsh/carousel` cumple el esquema guardado (campo que falta o cambia de tipo → fallo; campo nuevo → aviso). Usa la respuesta capturada en vivo.

## Endpoints afectados
- `POST nsh/carousel`

## Pantallas / funcionalidad afectada
- Home: carruseles que se cargan bajo demanda (p. ej. *Zuletzt gesehen*).

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.
- El contrato se infirió de **1 sola muestra** (captura del 2026-11-09): puede marcar como obligatorios campos que en realidad son opcionales. Si da falsos positivos, añadir la ruta a `contracts/overrides.json`.

## Resultado esperado
- Respuesta 2xx y cuerpo conforme al contrato `contracts/26.10.100/`.

## Cómo ejecutar
```
npx playwright test tests/home/contrato/carousel
```
