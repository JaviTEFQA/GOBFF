# [HomeZone][contrato] GET nsh/devices

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76690 |
| Tipo | Contrato |
| Componente | HomeZone |
| Versión base | 26.10.100 |

## Qué hace
Valida que la respuesta real de `GET nsh/devices` cumple el esquema guardado (campo que falta o cambia de tipo → fallo; campo nuevo → aviso). Usa la respuesta capturada en vivo.

## Endpoints afectados
- `GET nsh/devices`

## Pantallas / funcionalidad afectada
- Ajustes > Geräte verwalten (ClientZone: dispositivos STB y OTT).

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas (journey `settings-sections`).

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.
- Contrato inferido de la captura en vivo del 2026-11-09 (`npm run contracts:from-live`): con pocas muestras puede marcar como obligatorios campos opcionales. Si da falsos positivos, añadir la ruta a `contracts/overrides.json`.

## Resultado esperado
- Respuesta 2xx y cuerpo conforme al contrato `contracts/26.10.100/`.

## Cómo ejecutar
```
npx playwright test tests/homezone/contrato/dispositivos
```
