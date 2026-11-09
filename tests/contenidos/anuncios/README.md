# [Contenidos][negocio] Publicidad: hasAds y hasPrerollAds

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76670 |
| Tipo | API · negocio |
| Historias | GO-35350, GO-35725, GO-35955, GO-35973 |
| TCs manuales que automatiza | MULTISTC-54044, 54642, 65318, 54584 |
| Versión base | 26.10.100 |

## Qué hace
Recorre todos los contenidos capturados (carruseles, parrilla, áreas temáticas, fichas) y comprueba que el BFF propaga `hasAds` en películas, episodios y grabaciones, y `hasAds` + `hasPrerollAds` en todos los LSC; que son booleanos, que la ficha de una película los trae en la raíz y que un mismo contenido no cambia de valor según la pantalla. En Alemania el caso de zapping (GO-35955) no inserta publicidad (solo España): aquí solo se valida la propagación.

## Endpoints afectados
- `GET channels`
- `GET nsh/thematic-site-page-prio`
- `GET nsh/thematic-site-page/{pid}`
- `POST nsh/carousel`
- `GET nsh/unified-detailed/{pid}`

## Pantallas / funcionalidad afectada
- Inserción de publicidad (VMAP) en VoD, grabaciones, directo y LxD: la app decide si pide VMAP según estos flags.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.


## Resultado esperado
- Todo LSC trae `hasAds` y `hasPrerollAds`.
- `hasAds`/`hasPrerollAds` booleanos allí donde aparecen.
- La ficha de una MOV trae `hasAds`.
- Mismo pid → mismo valor en todos los endpoints.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/contenidos/anuncios
```
