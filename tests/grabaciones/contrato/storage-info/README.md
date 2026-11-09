# [Grabaciones][contrato] GET nsh/recordings/storage-info

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76640 |
| Tipo | Contrato |
| Componente | Grabaciones |
| Versión base | 26.10.100 |

## Qué hace
Valida que la respuesta real de `GET nsh/recordings/storage-info` cumple el esquema guardado (campo que falta o cambia de tipo → fallo; campo nuevo → aviso). Usa la respuesta capturada en vivo.

## Endpoints afectados
- `GET nsh/recordings/storage-info`

## Pantallas / funcionalidad afectada
- Barra de almacenamiento.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.

## Resultado esperado
- Respuesta 2xx y cuerpo conforme al contrato `contracts/26.10.100/`.

## Cómo ejecutar
```
npx playwright test tests/grabaciones/contrato/storage-info
```
