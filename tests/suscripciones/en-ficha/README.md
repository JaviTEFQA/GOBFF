# [Suscripciones][negocio] Paquetes ofrecidos en la ficha de contenido

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76684 |
| Tipo | API · negocio |
| Historias | GO-36315 |
| TCs manuales que automatiza | MULTISTC-68325, 68326, 68327 |
| Versión base | 26.10.100 |

## Qué hace
En cada contenido con `subscriptions`: cada paquete ofrecido trae pid SUB…, title, pricings recurrentes (isRecurring=true) y logo de tipo Icon; sin paquetes comprables no se muestra el botón de suscribirse; nunca "pendiente de activación" con canWatch=true.

## Endpoints afectados
- `GET nsh/unified-detailed/{pid}`
- `GET channels`
- `GET nsh/thematic-site-page-prio`
- `POST nsh/carousel`

## Pantallas / funcionalidad afectada
- Ficha de contenido y carruseles: botón y tira de paquetes para suscribirse.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.


## Resultado esperado
- Paquetes bien formados y botón coherente.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/suscripciones/en-ficha
```
