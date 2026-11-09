# [API][canoway] Cada ficha de detalle describe su propio contenido

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76651 |
| Tipo | API · negocio |
| Prioridad | Alta (smoke) |
| Versión base | 26.10.100 |

## Qué hace
Valida las respuestas reales de detalle (`nsh/unified-detailed/{pid}`) capturadas en vivo al abrir fichas de varios tipos (película, serie, directo, grabación). Comprueba que cada ficha ES el contenido pedido (su propio `pid`), no uno relacionado de un carrusel, y que trae `title`.

## Endpoints afectados
- `GET nsh/unified-detailed/{pid}`

## Pantallas / funcionalidad afectada
- Ficha de contenido (películas, series, directos, grabaciones): si falla, se abre una ficha equivocada o sin título.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas (proyectos `auth` y `live-capture`).

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los PIDs los elige la propia navegación de la app, así que no caducan.

## Resultado esperado
- Cada ficha capturada responde 200.
- `body.pid` coincide con el PID de la URL y `body.title` es string no vacío (aserciones *soft*: se validan todos los tipos y se informa de cada uno).

## Cómo ejecutar
```
npx playwright test tests/fichas/propio-contenido
```
