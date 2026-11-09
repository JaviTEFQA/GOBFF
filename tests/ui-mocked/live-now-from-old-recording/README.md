# [WEB][mock canoway] "Jetzt" muestra programas en emisión con datos grabados

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76667 |
| Tipo | UI · regresión con mocks (fechas) |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Abre TV-Guide › Jetzt con canoway servido desde grabaciones que pueden tener días de antigüedad. Comprueba que siguen apareciendo programas en emisión. Valida el mecanismo de desplazamiento de fechas: todas las fechas de la grabación (inicio y fin de emisión, disponibilidad, etc.) se mueven el tiempo transcurrido desde que se grabó. Así, lo que estaba en emisión al grabar lo está también al ejecutar.

## Endpoints afectados
- Todas las llamadas a canoway de TV-Guide › Jetzt (canales, EPG en emisión, menú), servidas desde grabación

## Pantallas / funcionalidad afectada
- TV-Guide › Jetzt (en emisión) y cards de directo.

## Precondiciones
- Sesión web válida (proyecto `auth`, automático).
- Grabación del recorrido `tv-guide-now` de la 26.10.100 (`npm run record`).

## Datos y mocks
- Grabaciones sin modificar, salvo el desplazamiento de fechas en modo `exact`.
- Si esta prueba falla y con `dateShift: 'none'` también, el problema está en el desplazamiento o en un formato de fecha nuevo. Ver `src/mocks/date-shift.ts`.

## Resultado esperado
- Se ve la cabecera de la app.
- Hay al menos una card de directo (`/details/live…`).
- Parte de las respuestas se ha servido desde grabación.

## Cómo ejecutar
```
npx playwright test tests/ui-mocked/live-now-from-old-recording
```
