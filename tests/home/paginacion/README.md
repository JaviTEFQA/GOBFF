# [API][canoway] La rejilla "ver todo" pagina de forma coherente

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76650 |
| Tipo | API · negocio |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Valida la respuesta real de `nsh/thematic-grid-page/{pid}` (capturada en vivo al abrir una rejilla "ver todo"): trae `thematicGrid.contents` no vacío, `page` numérico, `orderList` como lista y, si anuncia `nextPage`, que es exactamente `page + 1` (sin saltos ni bucles de paginación).

## Endpoints afectados
- `GET nsh/thematic-grid-page/{pid}`

## Pantallas / funcionalidad afectada
- Rejilla "ver todo" de un área/carrusel: una paginación incoherente repite o salta contenidos al hacer scroll.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.

## Resultado esperado
- `thematicGrid.contents` lista no vacía; `page` numérico; `orderList` lista.
- Si hay `nextPage`, es `page + 1` (aserción *soft*).

## Cómo ejecutar
```
npx playwright test tests/home/paginacion
```
