# [Perfiles][contrato] GET users/switchProfile

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76634 |
| Tipo | Contrato |
| Componente | Perfiles |
| Versión base | 26.10.100 |

## Qué hace
Valida que la respuesta real de `GET users/switchProfile` cumple el esquema guardado (campo que falta o cambia de tipo → fallo; campo nuevo → aviso). Usa la respuesta capturada en vivo.

## Endpoints afectados
- `GET users/switchProfile`

## Pantallas / funcionalidad afectada
- Cambio de perfil activo (rota el token).

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks.

## Resultado esperado
- Respuesta 2xx y cuerpo conforme al contrato `contracts/26.10.100/`.

## Cómo ejecutar
```
npx playwright test tests/perfiles/contrato/switch-profile
```
