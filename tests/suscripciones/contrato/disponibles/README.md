# [Suscripciones][contrato] GET nsh/subscriptions/available

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76688 |
| Tipo | Contrato |
| Componente | Suscripciones |
| Versión base | 26.10.100 |

## Qué hace
Valida que la respuesta real de `GET nsh/subscriptions/available` cumple el esquema guardado (campo que falta o cambia de tipo → fallo; campo nuevo → aviso). Usa la respuesta capturada en vivo.

## Endpoints afectados
- `GET nsh/subscriptions/available`

## Pantallas / funcionalidad afectada
- Ajustes > TV-Pakete > Verfügbare TV-Pakete (paquetes que se pueden contratar).

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas (journey `settings-sections`).

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.
- Contrato inferido de la captura en vivo del 2026-11-09 (`npm run contracts:from-live`): con pocas muestras puede marcar como obligatorios campos opcionales. Si da falsos positivos, añadir la ruta a `contracts/overrides.json`.

## Resultado esperado
- Respuesta 2xx y cuerpo conforme al contrato `contracts/26.10.100/`.

## Cómo ejecutar
```
npx playwright test tests/suscripciones/contrato/disponibles
```
