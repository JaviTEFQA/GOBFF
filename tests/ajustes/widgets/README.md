# [API][canoway] Settings: widgets bien formados (incl. widget dinámico type 63)

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76655 |
| Tipo | API · negocio |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Valida la respuesta real de `nsh/settings` (capturada en vivo): la raíz trae `pid` y `title`, y cada widget de `childSettings` trae `type` numérico y `pid`. Si aparece el widget dinámico `type 63` (GO-36521), comprueba además que tiene título.

## Endpoints afectados
- `GET nsh/settings`

## Pantallas / funcionalidad afectada
- Pantalla de Ajustes: un widget sin `type`/`pid` no se pinta ni navega.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. El tipo de widgets presente depende del perfil/cuenta; el `type 63` solo se valida si aparece.

## Resultado esperado
- `pid` y `title` en la raíz; `childSettings` lista no vacía.
- Todo widget con `type` numérico y `pid` no vacío (aserción *soft*).
- Los widgets `type 63`, si los hay, con título (aserción *soft*).

## Cómo ejecutar
```
npx playwright test tests/ajustes/widgets
```
