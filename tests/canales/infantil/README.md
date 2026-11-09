# [Canales][negocio] Contenidos infantiles: isKids en LCH

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76673 |
| Tipo | API · negocio |
| Historias | GO-36935 |
| TCs manuales que automatiza | MULTISTC-64665 |
| Versión base | 26.10.100 |

## Qué hace
"BFF propagará el param isKids en todos los objetos LCH que puedan aparecer en carruseles, grids, búsquedas" (GOSPECS-4968): todo canal trae `isKids` booleano y coherente entre pantallas. Si la captura se hizo con un perfil infantil (`channels?is_kids=true`), la parrilla no puede traer canales con isKids=false.

## Endpoints afectados
- `GET channels`
- `GET nsh/channels/userOrder`
- `POST nsh/carousel`
- `GET nsh/thematic-grid-page/{pid}`
- `GET nsh/thematic-site-page-prio`

## Pantallas / funcionalidad afectada
- EPG, miniguía y carruseles del perfil infantil.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.
- La cuenta de pruebas no tiene perfil infantil: la regla de filtrado se anota como "no aplica" hasta capturar con un perfil Kids (`PROFILE_NAME`).

## Resultado esperado
- Todo LCH completo trae `isKids` booleano.
- Mismo canal → mismo valor.
- Perfil infantil: ningún canal adulto en la parrilla (si aplica).
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/canales/infantil
```
