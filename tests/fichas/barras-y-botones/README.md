# [Fichas][negocio] Barras y metadata de la ficha

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76678 |
| Tipo | API · negocio |
| Historias | GO-35633, GO-35694 |
| TCs manuales que automatiza | MULTISTC-61944, 61945, 61946, 61947, 61949, 68837, 68838, 53539, 53540, 53541, 53542, 53545, 53628 |
| Versión base | 26.10.100 |

## Qué hace
Recalcula las barras que el BFF deriva de `rights.canWatch`, `pricings`, `subscriptions` y `deviceTypes` y las compara con las que devuelve, en la ficha y en todo contenido que las traiga: isPurchaseVisible, isSubscribeVisible (con la precedencia de isActivatedPendingVisible), isActivatedPendingVisible y isNotAvailableInThisDevice (Web = deviceType 401). Además valida la metadata: tráileres del propio contenido, emisiones futuras del episodio relevante (sin pasadas ni la propia), relevantEpisode en SER/LSR, renderChild, commercialization e isComingSoon.

## Endpoints afectados
- `GET nsh/unified-detailed/{pid}`
- `GET nsh/thematic-site-page-prio`
- `POST nsh/carousel`
- `GET channels`

## Pantallas / funcionalidad afectada
- Ficha de contenido: barras de compra/suscripción/no disponible, tráiler y próximas emisiones.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.
- 61943 (canal oculto), 53544 (botones de grabación E2E), 53546 (deprecaciones), 53551 (triángulos en versiones anteriores) y 68839 necesitan datos o versiones que la web 26.10 no da: quedan manuales.

## Resultado esperado
- Ningún contenido con barras distintas de las calculadas.
- Metadata con el formato de la historia.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/fichas/barras-y-botones
```
