# [Fichas][negocio] Relacionados (Similares)

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76677 |
| Tipo | API · negocio |
| Historias | GO-36810 |
| TCs manuales que automatiza | MULTISTC-65576, 65577 |
| Versión base | 26.10.100 |

## Qué hace
En cada ficha capturada, `relatedContents` o no aparece, o es `{collectionLayoutStyle: "portraitSmall", type: "category", contents: [≥1]}` sin pid/title/refreshAfter/showAllPid/showGrid/isMoreContentsEnabled. Nunca null, [] ni {}.

## Endpoints afectados
- `GET nsh/unified-detailed/{pid}`

## Pantallas / funcionalidad afectada
- Ficha de contenido: tira inferior de similares.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.


## Resultado esperado
- Forma de "Similares" o ausencia total.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/fichas/relacionados
```
