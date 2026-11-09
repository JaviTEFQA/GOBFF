# [Control parental][negocio] PIN de adultos: requiresPin

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76674 |
| Tipo | API · negocio |
| Historias | GO-36535 |
| TCs manuales que automatiza | MULTISTC-61142, 61144, 61146, 61147, 61148, 61149, 61150 |
| Versión base | 26.10.100 |

## Qué hace
Comprueba que el BFF señaliza `requiresPin` en la raíz de la ficha, de ThematicGridPage y de ThematicSitePage; por ítem en los carruseles; por colección hija (CHA) en las áreas temáticas y en el menú; y que el valor de cada CHA coincide con `ca_requiresPin` de la ContentAPI (la fuente, que la web descarga al arrancar).

## Endpoints afectados
- `GET nsh/unified-detailed/{pid}`
- `GET nsh/thematic-grid-page/{pid}`
- `GET nsh/thematic-site-page/{pid}`
- `GET nsh/thematic-site-page-prio`
- `POST nsh/carousel`
- `GET nsh/menu`
- ContentAPI `contents/all?contentTypes=CHA` (referencia)

## Pantallas / funcionalidad afectada
- Acceso a la sección de adultos: la app pide el PIN antes de abrir lo que viene con requiresPin=true.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.
- En esta cuenta ningún CHA es adulto (470 CHA, todos `ca_requiresPin=False`): se valida presencia, formato y coincidencia con la fuente; el caso `true` se comprobará cuando haya contenido adulto.

## Resultado esperado
- `requiresPin` booleano en todas las localizaciones.
- BFF = ContentAPI para cada CHA.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/control-parental/pin-adultos
```
