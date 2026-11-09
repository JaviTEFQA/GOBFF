# [Grabaciones][seguridad] recordings y storage-info rechazan sin token

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76658 |
| Tipo | Seguridad |
| Componente | Grabaciones |
| Versión base | 26.10.100 |

## Qué hace
Comprueba que el endpoint responde 2xx con la sesión del usuario (control, vía captura en vivo) y 401/403 ante una llamada directa sin token.

## Endpoints afectados
- `GET nsh/recordings`
- `GET nsh/recordings/storage-info`

## Pantallas / funcionalidad afectada
- Grabaciones y almacenamiento (datos privados).

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Control desde captura en vivo; la llamada sin token es directa a canoway.

## Resultado esperado
- Control: 2xx con sesión. Sin token: 401 o 403.

## Cómo ejecutar
```
npx playwright test tests/grabaciones/sin-token
```
