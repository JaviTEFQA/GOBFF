# [API][canoway] La home devuelve secciones con contenidos navegables

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76648 |
| Tipo | API · negocio |
| Prioridad | Alta (smoke) |
| Versión base | 26.10.100 |

## Qué hace
Valida la respuesta real de la home del BFF 26.10 (`nsh/thematic-site-page-prio`), capturada en vivo desde la web logada. Comprueba que la home es utilizable: tiene ≥ 1 sección, cada sección declara `type`, y las tarjetas de contenido traen `pid` (para abrir la ficha) y `title` (para pintarse). Las tarjetas de enlace (`LNK…`) se excluyen: son accesos de navegación sin título por diseño.

## Endpoints afectados
- `GET nsh/thematic-site-page-prio`

## Pantallas / funcionalidad afectada
- Home (carruseles, editoriales, directos): si falla, la home sale vacía o con tarjetas que no abren ficha.

## Precondiciones
- Cuenta O2 DE válida en `.env`; la sesión y la captura en vivo se obtienen automáticamente (proyectos `auth` y `live-capture`).

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado (`.live/<versión>/capture.json`). Sin mocks. canoway firma cada petición, por eso no se reenvía: se valida la respuesta que pidió la app.

## Resultado esperado
- Status 200.
- `thematicSite` es lista de ≥ 1 sección, todas con `type` string no vacío y `contents` (si viene) como lista.
- ≥ 1 tarjeta de contenido (no enlace) y ninguna sin `pid`/`title` string no vacío (aserciones *soft*, hasta 10 ejemplos).

## Cómo ejecutar
```
npx playwright test tests/home/secciones
```
