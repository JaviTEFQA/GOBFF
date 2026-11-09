# [Fichas][negocio] Error estructurado con pid inexistente

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76679 |
| Tipo | API · negocio |
| Historias | GO-35694 |
| TCs manuales que automatiza | MULTISTC-53547 |
| Versión base | 26.10.100 |

## Qué hace
La journey `detail-invalid` abre `/details/movie/qa-invalid-999999999`; la web llama a `unified-detailed/MOV999999999` y la captura guarda la respuesta de error. Comprueba que es un 4xx (no 200) con `errors[]` que trae `message` y `code`.

## Endpoints afectados
- `GET nsh/unified-detailed/{pid}`

## Pantallas / funcionalidad afectada
- Pantalla "Es ist ein Fehler aufgetreten" al abrir un enlace roto.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.
- Pid vacío (400) y sin permisos (403) no se pueden provocar desde la web: quedan manuales.

## Resultado esperado
- 4xx con error estructurado.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/fichas/error-pid
```
