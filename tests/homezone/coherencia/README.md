# [API][canoway] HomeZone: check responde de forma coherente

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76656 |
| Tipo | API · negocio |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Valida la respuesta real de `POST nsh/users/{id}/homezone/check` (capturada en vivo; la app la hace al arrancar): trae `canSetHome` booleano y un `result` no vacío y conocido (`inHome`/`outOfHome`/…).

## Endpoints afectados
- `POST nsh/users/{id}/homezone/check`

## Pantallas / funcionalidad afectada
- Control de concurrencia y zona del hogar (HomeZone): un `result` desconocido o `canSetHome` no booleano rompe la decisión de permitir fijar el hogar.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Es un POST idempotente de consulta (check), no una mutación.

## Resultado esperado
- `canSetHome` booleano y `result` string no vacío.
- `result` entre los valores conocidos (aserción *soft*: un valor nuevo se señala sin romper).

## Cómo ejecutar
```
npx playwright test tests/homezone/coherencia
```
