# [API][canoway] Grabaciones y almacenamiento coherentes

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76653 |
| Tipo | API · negocio |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Valida las respuestas reales de `nsh/recordings/storage-info` y `nsh/recordings` (capturadas en vivo): los porcentajes de almacenamiento están en 0..100 y el estado es coherente con el uso (si está `over-quota`, el uso supera el umbral de aviso); cada grabación agendada trae `pid`, `channelPid` y una fecha de emisión válida.

## Endpoints afectados
- `GET nsh/recordings/storage-info`
- `GET nsh/recordings`

## Pantallas / funcionalidad afectada
- Mein TV · Grabaciones y la barra de almacenamiento: porcentajes incoherentes engañan sobre el espacio; una agendada sin pid/canal/fecha no se pinta ni se ordena.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.

## Resultado esperado
- `usedPercentage` y `percentage` numéricos en 0..100.
- `over-quota` ⇒ `usedPercentage >= warningThreshold` (aserción *soft*).
- Toda grabación agendada con `pid`/`channelPid` string y `emissionDate.start` numérico (aserción *soft*).

## Cómo ejecutar
```
npx playwright test tests/grabaciones/almacenamiento
```
