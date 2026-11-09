# [API][canoway] Integridad de los perfiles (uno por defecto, isExitBlocked)

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76632 |
| Historia | GO-35243 |
| Tipo | API · negocio |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Valida la respuesta real de `nsh/profiles` (capturada en vivo): hay exactamente un perfil por defecto, todos traen `isExitBlocked` (el campo que añade GO-35243) y cada perfil tiene `id` numérico, `name` no vacío y las flags (`isKids`, `hasAccessCode`, `isBlocked`) booleanas.

## Endpoints afectados
- `GET nsh/profiles`

## Pantallas / funcionalidad afectada
- Selector de perfiles y gestión de perfiles: con cero/dos perfiles por defecto el cliente no sabe cuál abrir; sin `isExitBlocked` falla el control de salida del perfil Kids.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.

## Resultado esperado
- `profiles` es lista no vacía.
- Exactamente 1 perfil con `isDefaultProfile === true`.
- Todos con `isExitBlocked` booleano (aserción *soft*).
- Ningún perfil con `id`/`name`/flags inválidos (aserción *soft*).

## Cómo ejecutar
```
npx playwright test tests/perfiles/integridad
```
