# [Perfiles][seguridad] nsh/profiles rechaza sin token

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76657 |
| Tipo | Seguridad |
| Componente | Perfiles |
| Versión base | 26.10.100 |

## Qué hace
Comprueba que el endpoint responde 2xx con la sesión del usuario (control, vía captura en vivo) y 401/403 ante una llamada directa sin token.

## Endpoints afectados
- `GET nsh/profiles`

## Pantallas / funcionalidad afectada
- Selector de perfiles (datos privados del usuario).

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Control desde captura en vivo; la llamada sin token es directa a canoway.

## Resultado esperado
- Control: 2xx con sesión. Sin token: 401 o 403.

## Cómo ejecutar
```
npx playwright test tests/perfiles/sin-token
```
