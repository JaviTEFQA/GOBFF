# [Canales][negocio] Marca de agua: wmk en LCH

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76672 |
| Tipo | API · negocio |
| Historias | GO-36266 |
| TCs manuales que automatiza | MULTISTC-65250 |
| Versión base | 26.10.100 |

## Qué hace
"BFF propagará el param wmk directamente de APIHub" (GOSPECS-4473): todo objeto de canal (LCH) con título trae `wmk` booleano, con el mismo valor en parrilla, carruseles, ficha y gestión de canales. El playback trae `wmkEnabled` booleano.

## Endpoints afectados
- `GET channels`
- `GET nsh/channels/userOrder`
- `POST nsh/carousel`
- `GET nsh/unified-detailed/{pid}`
- `GET playback/information`

## Pantallas / funcionalidad afectada
- Player de directo: la app superpone la marca de agua de Nagra solo en canales con wmk=true.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.


## Resultado esperado
- Todo LCH completo trae `wmk` booleano.
- Mismo canal → mismo `wmk` en todas las pantallas.
- `wmkEnabled` booleano en playback.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/canales/marca-de-agua
```
