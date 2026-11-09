# [HomeZone][contrato] POST nsh/users/{id}/homezone/check

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76646 |
| Tipo | Contrato |
| Componente | HomeZone |
| Versión base | 26.10.100 |

## Qué hace
Valida que la respuesta real de `POST nsh/users/{id}/homezone/check` cumple el esquema guardado (campo que falta o cambia de tipo → fallo; campo nuevo → aviso). Usa la respuesta capturada en vivo.

## Endpoints afectados
- `POST nsh/users/{id}/homezone/check`

## Pantallas / funcionalidad afectada
- Control de concurrencia y zona del hogar.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.

## Resultado esperado
- Respuesta 2xx y cuerpo conforme al contrato `contracts/26.10.100/`.

## Cómo ejecutar
```
npx playwright test tests/homezone/contrato/check
```
