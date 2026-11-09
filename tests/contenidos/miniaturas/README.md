# [Contenidos][negocio] Miniaturas: hasThumbnails

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76671 |
| Tipo | API · negocio |
| Historias | GO-35216, GO-35292 |
| TCs manuales que automatiza | MULTISTC-52070 |
| Versión base | 26.10.100 |

## Qué hace
"BFF propagará en todos los contenidos el param hasThumbnails" (GOSPECS-4509): comprueba que es booleano, que la ficha de un contenido reproducible lo trae, que cada LSC lleva el mismo valor que su canal (`liveChannel.hasThumbnails`) y que un mismo contenido no cambia de valor según la pantalla.

## Endpoints afectados
- `GET channels`
- `GET nsh/thematic-site-page-prio`
- `POST nsh/carousel`
- `GET nsh/unified-detailed/{pid}`

## Pantallas / funcionalidad afectada
- Miniaturas del scrubbing en el player: la app solo pide Thumbnails API si hasThumbnails=true.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.


## Resultado esperado
- `hasThumbnails` booleano.
- Fichas MOV/EPI/LSC/REC lo traen.
- LSC = valor de su canal.
- Mismo pid → mismo valor.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/contenidos/miniaturas
```
