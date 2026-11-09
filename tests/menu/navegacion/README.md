# [API][canoway] El menú es navegable y bien formado

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76654 |
| Tipo | API · negocio |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Valida la respuesta real de `nsh/menu` (capturada en vivo): el menú superior trae entradas con `pid` y `titleInMenu`, flags booleanas, ninguna entrada superior abre ventana nueva (la navegación principal es interna) y existen las secciones `profileMenu`, `minimalBottomMenu` y `supportMenu`.

## Endpoints afectados
- `GET nsh/menu`

## Pantallas / funcionalidad afectada
- Menú/navegación principal: una entrada sin pid/título no navega ni se pinta; una que abre ventana nueva rompe la navegación interna.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.

## Resultado esperado
- `topMenu` lista no vacía; cada entrada con `pid`/`titleInMenu` y flags booleanas (aserción *soft*).
- Ninguna entrada superior con `opensNewWindow === true` (aserción *soft*).
- Presentes las secciones `profileMenu`, `minimalBottomMenu`, `supportMenu` (aserción *soft*).

## Cómo ejecutar
```
npx playwright test tests/menu/navegacion
```
