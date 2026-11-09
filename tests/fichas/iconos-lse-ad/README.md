# [Fichas][negocio] Iconos LSE y audiodescripción

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76681 |
| Tipo | API · negocio |
| Historias | GO-36549 |
| TCs manuales que automatiza | MULTISTC-64207, 64208, 64209, 64210, 53626, 53627 |
| Versión base | 26.10.100 |

## Qué hace
En áreas temáticas, carruseles y fichas, `is5s` e `isAudioDescription` son booleanos (o ausentes), independientes y con el mismo valor para un mismo contenido en todas las pantallas. Las fichas MOV/SER los traen en la raíz.

## Endpoints afectados
- `GET nsh/thematic-site-page/{pid}`
- `GET nsh/thematic-site-page-prio`
- `POST nsh/carousel`
- `GET nsh/unified-detailed/{pid}`

## Pantallas / funcionalidad afectada
- Iconos LSE/AD en la información del contenido.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.
- El campo real es `is5s` (los TCs manuales escriben `is5S`).

## Resultado esperado
- Formato y coherencia de ambos flags.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/fichas/iconos-lse-ad
```
