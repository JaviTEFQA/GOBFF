# [Grabaciones][contrato] GET nsh/recordings

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76639 |
| Tipo | Contrato |
| Componente | Grabaciones |
| Versión base | 26.10.100 |

## Qué hace
Valida que la respuesta real de `GET nsh/recordings` cumple el esquema guardado (campo que falta o cambia de tipo → fallo; campo nuevo → aviso). Usa la respuesta capturada en vivo.

## Endpoints afectados
- `GET nsh/recordings`

## Pantallas / funcionalidad afectada
- Mein TV · Grabaciones.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.

## Resultado esperado
- Respuesta 2xx y cuerpo conforme al contrato `contracts/26.10.100/`.

## Cómo ejecutar
```
npx playwright test tests/grabaciones/contrato/recordings
```
