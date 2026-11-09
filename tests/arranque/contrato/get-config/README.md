# [Arranque][contrato] GET directory/getConfig

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76647 |
| Tipo | Contrato |
| Componente | Arranque |
| Versión base | 26.10.100 |

## Qué hace
Valida que la respuesta real de `GET directory/getConfig` cumple el esquema guardado (campo que falta o cambia de tipo → fallo; campo nuevo → aviso). Usa la respuesta capturada en vivo.

## Endpoints afectados
- `GET directory/getConfig`

## Pantallas / funcionalidad afectada
- Arranque de la app.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.

## Resultado esperado
- Respuesta 2xx y cuerpo conforme al contrato `contracts/26.10.100/`.

## Cómo ejecutar
```
npx playwright test tests/arranque/contrato/get-config
```
