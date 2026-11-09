# [Contenidos][negocio] Redirecciones de salida: uniqueId, logoutUrl, epgScheduleId

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76676 |
| Tipo | API · negocio |
| Historias | GO-36163 |
| TCs manuales que automatiza | MULTISTC-65481, 65482, 65483 |
| Versión base | 26.10.100 |

## Qué hace
Cada ficha (`unified-detailed`) expone `uniqueId` y `logoutUrl` como texto; `epgScheduleId` solo aparece en LiveSchedule (LSC) y nunca vacío; `logoutUrl` nunca es null ni objeto (vacío = fallback sin alterar).

## Endpoints afectados
- `GET nsh/unified-detailed/{pid}`
- `GET channels`
- `GET nsh/thematic-site-page-prio`
- `POST nsh/carousel`

## Pantallas / funcionalidad afectada
- Logout desde una ficha: la web concatena logoutUrl + epgScheduleId + uniqueId para redirigir a la web de captación (solo ES).

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.


## Resultado esperado
- Fichas con `uniqueId` y `logoutUrl` string.
- `epgScheduleId` solo en LSC.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/contenidos/redirecciones-salida
```
