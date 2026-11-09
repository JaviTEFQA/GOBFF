# [API][canoway][mutación] Añadir a Meine Liste y quitar

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76699 |
| Tipo | API · mutación (escritura) |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Prueba de escritura real contra el BFF, guiada por UI. En la ficha de una película que no está en la lista pulsa *Auf meine Liste*, verifica que la ficha pasa a `tags.favorite=true` con el botón de quitar, y la **quita** al terminar (*Aus Liste löschen*). Patrón hacer → verificar → deshacer.

## Endpoints afectados
- `PUT nsh/tags` (`{Pid, TagType:2}`: añadir a la lista)
- `DELETE nsh/tags` (quitar de la lista)
- `GET nsh/unified-detailed/{pid}` (verificación: `tags.favorite`, `buttons.isAddMyListVisible` / `isRemoveMyListVisible`)

## Pantallas / funcionalidad afectada
- Ficha de película (botón *Auf meine Liste* / *Aus Liste löschen*) y Mein TV · Meine Liste.

## Precondiciones
- `API_ALLOW_MUTATIONS=true` (si no, se omite).
- Sesión guardada (proyecto `auth`).
- Alguna película de la Videothek que no esté ya en la lista.

## Datos y mocks
- Sin mocks: escritura real en prod. Solo usa una película que no estaba en la lista y la deja como estaba.

## Resultado esperado
- Añadir y quitar responden 2xx.
- Tras añadir, la ficha marca `tags.favorite=true`, ofrece quitar y no ofrece añadir; tras quitar, `tags.favorite=false`.

## Cómo ejecutar
```
API_ALLOW_MUTATIONS=true npx playwright test --project=mutations tests/favoritos/mi-lista
```
