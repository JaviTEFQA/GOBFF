# [Suscripciones][negocio] Ficha del paquete: estado, barras y botones

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76683 |
| Tipo | API · negocio |
| Historias | GO-36315 |
| TCs manuales que automatiza | MULTISTC-68314, 68315, 68316, 68317, 68322, 68323, 68324 |
| Versión base | 26.10.100 |

## Qué hace
En la ficha del paquete: `image` es el Banner y `logo.image` el Icon; `bars` marca un único estado y nunca `isActivationWarningVisible`; los botones siguen la tabla del estado (NO_CONTRATADA → solo añadir; EN_PROCESO_DE_CONTRATACION → solo más detalle; CONTRATADA → sin añadir ni más detalle); T&C solo con `services`, que nunca viene vacío; un paquete contratado no sale como NO_CONTRATADA.

## Endpoints afectados
- `GET nsh/subscription/{pid}`
- `GET nsh/subscriptions/purchased`

## Pantallas / funcionalidad afectada
- Ficha del paquete (/details/subscription/…): "Gebucht", "TV-Paket kündigen".

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.
- Con la cuenta de pruebas solo se ve el estado CONTRATADA (o2 TV M). 68318–68321 necesitan compras canceladas, pendientes o en error.

## Resultado esperado
- Estado, barras y botones coherentes.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/suscripciones/estado
```
