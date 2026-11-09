# [HomeZone][negocio] ClientZone: dispositivos

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76685 |
| Tipo | API · negocio |
| Historias | GO-36090 |
| TCs manuales que automatiza | MULTISTC-60861, 60862, 60863, 60864 |
| Versión base | 26.10.100 |

## Qué hace
`nsh/devices` trae listas `stb` y `ott` y un `total` que cuenta todos aunque la lista OTT se trunque; cada dispositivo trae deviceId, deviceType, deviceName, isActive, lastModified y `buttons` (isStopVisible, isDeleteVisible) booleanos; un dispositivo inactivo no muestra "parar"; sin deviceId repetidos. Solo lectura.

## Endpoints afectados
- `GET nsh/devices`

## Pantallas / funcionalidad afectada
- Ajustes > Geräte verwalten.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.
- Renombrar, borrar y cerrar sesión (60866–60873) son mutaciones que pueden desloguear dispositivos: quedan fuera hasta acordar una cuenta/dispositivo desechable.

## Resultado esperado
- Lista bien formada, truncada sin perder el total, botones coherentes.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/homezone/dispositivos
```
