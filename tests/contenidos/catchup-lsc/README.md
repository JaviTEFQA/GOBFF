# [Contenidos][negocio] Catchup como LSC

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76675 |
| Tipo | API · negocio |
| Historias | GO-36384 |
| TCs manuales que automatiza | MULTISTC-68673, 68674, 68675, 68677, 69605 |
| Versión base | 26.10.100 |

## Qué hace
Clasifica cada LSC capturado según su emisión y disponibilidad respecto al momento de la respuesta: catchup (emitido, `availableUntilPolaris` futura), caducado sin catchup, en emisión o futuro. Catchup → `isPlayVisible`, barra de caducidad e `isFFRWBlockedInLxD`, sin tráiler. Caducado → nada de eso. En emisión o futuro → sin `isFFRWBlockedInLxD`. Se deja un margen de 3 min para no evaluar programas en la frontera.

## Endpoints afectados
- `GET channels`
- `GET nsh/thematic-site-page-prio`
- `POST nsh/carousel`
- `GET nsh/unified-detailed/{pid}`

## Pantallas / funcionalidad afectada
- Programas ya emitidos en carruseles, EPG y ficha: botón de reproducir, barra "disponible hasta" y bloqueo de avance/retroceso.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.
- No automatizables desde la web: 68676 (bookmark), 68678 (logo), 68679 (canal con suscripción), 69604 (versiones anteriores y otros dispositivos), 69606 y 69614 (requieren resume del usuario).

## Resultado esperado
- Reglas por grupo (catchup / caducado / en emisión / futuro) sin incumplimientos.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/contenidos/catchup-lsc
```
