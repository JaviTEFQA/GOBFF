# [Reproducción][contrato] GET playback/information

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76645 |
| Tipo | Contrato |
| Componente | Reproducción |
| Versión base | 26.10.100 |

## Qué hace
Valida que la respuesta real de `GET playback/information` cumple el esquema guardado (campo que falta o cambia de tipo → fallo; campo nuevo → aviso). Usa la respuesta capturada en vivo.

## Endpoints afectados
- `GET playback/information`

## Pantallas / funcionalidad afectada
- Player (URLs, DRM).

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.

## Resultado esperado
- Respuesta 2xx y cuerpo conforme al contrato `contracts/26.10.100/`.

## Cómo ejecutar
```
npx playwright test tests/reproduccion/contrato/playback-information
```
