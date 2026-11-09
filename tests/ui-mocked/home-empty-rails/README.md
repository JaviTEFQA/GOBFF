# [WEB][mock canoway] Home con carruseles vacíos

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76666 |
| Tipo | UI · resiliencia con mocks |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Sirve `nsh/thematic-site-page-prio` con la estructura real grabada pero con todas las listas vacías (secciones sin contenidos), y `POST nsh/carousel` con una lista vacía. Verifica que la web lo soporta sin errores JS. Cubre el caso de un usuario o perfil sin contenido, o un catálogo vacío tras un fallo de ingesta.

## Endpoints afectados
- `GET nsh/thematic-site-page-prio` (listas vaciadas)
- `POST nsh/carousel` (lista vacía: no tiene grabación)

## Pantallas / funcionalidad afectada
- Home: carruseles y paginación de carruseles.

## Precondiciones
- Sesión web válida (proyecto `auth`, automático).
- Grabaciones de la 26.10.100 presentes.

## Datos y mocks
- Regla `rules.empty(...)` sobre la respuesta grabada; el resto de canoway se sirve desde las grabaciones, con fechas desplazadas.

## Resultado esperado
- La cabecera de la app está visible.
- No hay errores JS no capturados.

## Cómo ejecutar
```
npx playwright test tests/ui-mocked/home-empty-rails
```
