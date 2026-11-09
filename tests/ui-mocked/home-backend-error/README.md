# [WEB][mock canoway] La home aguanta un error 5xx de canoway

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76665 |
| Tipo | UI · resiliencia con mocks |
| Prioridad | Alta |
| Versión base | 26.10.100 |

## Qué hace
Simula que canoway responde 500 y luego 503 a `nsh/home`; son dos casos independientes. Comprueba que la web no se rompe: la cabecera sigue visible y no hay excepciones JS no capturadas. Es un escenario imposible de reproducir a demanda contra el backend real.

## Endpoints afectados
- `GET nsh/home` (forzado a 500 / 503)
- Resto de llamadas a canoway: respuestas grabadas de la 26.10.100

## Pantallas / funcionalidad afectada
- Home (estado de error / degradado).

## Precondiciones
- Sesión web válida (proyecto `auth`, automático).
- Grabaciones de la 26.10.100 presentes.

## Datos y mocks
- Regla `rules.error('GET nsh/home', 500|503)`; el resto de canoway se sirve desde las grabaciones, con fechas desplazadas a la hora de ejecución.

## Resultado esperado
- La cabecera de la app está visible.
- La web recibió el error mockeado.
- No hay errores JS no capturados.

## Cómo ejecutar
```
npx playwright test tests/ui-mocked/home-backend-error
```

## Notas
- Si producto define un mensaje de error concreto para este caso, añadir aquí su texto y validarlo en la prueba.
