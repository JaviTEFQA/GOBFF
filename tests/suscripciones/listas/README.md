# [Suscripciones][negocio] Paquetes contratados y disponibles

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76682 |
| Tipo | API · negocio |
| Historias | GO-36781 |
| TCs manuales que automatiza | MULTISTC-65309, 65310, 65311, 65313, 65314, 65315 |
| Versión base | 26.10.100 |

## Qué hace
`subscriptions/purchased` y `subscriptions/available` devuelven listas (vacías sin error si no hay); cada paquete contratado trae pid SUB…, title, shortDescription y logo con url; cada disponible trae pid, title y pricings. Un paquete no puede estar contratado y disponible a la vez.

## Endpoints afectados
- `GET nsh/subscriptions/purchased`
- `GET nsh/subscriptions/available`

## Pantallas / funcionalidad afectada
- Ajustes > TV-Pakete.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.
- 65312 y 65316 (fallo del resolvedor) requieren provocar un error en APIHub: quedan manuales.

## Resultado esperado
- Listas bien formadas y sin solaparse.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/suscripciones/listas
```
