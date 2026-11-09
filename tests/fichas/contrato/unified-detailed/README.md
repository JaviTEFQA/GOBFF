# [Fichas][contrato] GET nsh/unified-detailed/{pid}

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76638 |
| Tipo | Contrato |
| Componente | Fichas |
| Versión base | 26.10.100 |

## Qué hace
Valida que la respuesta real de `GET nsh/unified-detailed/{pid}` cumple el esquema guardado (campo que falta o cambia de tipo → fallo; campo nuevo → aviso). Usa la respuesta capturada en vivo.

## Endpoints afectados
- `GET nsh/unified-detailed/{pid}`

## Pantallas / funcionalidad afectada
- Ficha de contenido (película, serie, directo, grabación).

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.

## Resultado esperado
- Respuesta 2xx y cuerpo conforme al contrato `contracts/26.10.100/`.

## Cómo ejecutar
```
npx playwright test tests/fichas/contrato/unified-detailed
```
