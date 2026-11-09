# [API][canoway] Comercialización coherente en el detalle

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76652 |
| Tipo | API · negocio |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Valida la comercialización en las fichas reales (`nsh/unified-detailed/{pid}`) capturadas en vivo: `commercialization.isTvod` e `isSubscribable` son booleanos, y toda película TVOD (`isTvod === true`) trae `pricings` no vacío (si no, no se podría alquilar).

## Endpoints afectados
- `GET nsh/unified-detailed/{pid}`

## Pantallas / funcionalidad afectada
- Ficha de contenido y botones de compra/alquiler/suscripción: flags incoherentes o sin precios rompen el flujo de compra (triángulos y CTA).

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los PIDs los elige la navegación de la app, no caducan.

## Resultado esperado
- Cada ficha: `isTvod`/`isSubscribable` booleanos (aserción *soft*).
- Las fichas TVOD traen `pricings` no vacío (aserción *soft*).

## Cómo ejecutar
```
npx playwright test tests/fichas/comercializacion
```
