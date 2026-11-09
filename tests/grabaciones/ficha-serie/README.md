# [Grabaciones][negocio] Ficha de serie grabada: árbol de grabaciones

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76686 |
| Tipo | API · negocio |
| Historias | GO-36297, GO-36303 |
| TCs manuales que automatiza | MULTISTC-68552, 68553 (orden y foco), 68554, 68555 |
| Versión base | 26.10.100 |

## Qué hace
Abre las series grabadas desde "Verfügbare Aufnahmen" y "Geplante Aufnahmen" y valida el árbol de `unified-detailed/RSR…`: seasons RSE con episodios REC; sin relevantSeason, una única season y un único REC relevantes; la season de programadas (isFutureSeason) ordenada por emisión ascendente; como mucho un botón de cancelación por grabación; reproducir sobre el directo solo en curso; una programada no se reproduce ni se borra y una terminada no se cancela.

## Endpoints afectados
- `GET nsh/unified-detailed/{pid}`

## Pantallas / funcionalidad afectada
- Mein TV > Verfügbare / Geplante Aufnahmen > ficha de serie grabada.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.
- La web abre "Geplante Aufnahmen" con `?status=scheduled` en la ruta pero llama al BFF **sin** `status` (68553): anotado en docs/cobertura-historias.md.
- 68556 y 68557 dependen del KV `ALLOWED_RECORDING_LEVELS`: quedan manuales.

## Resultado esperado
- Árbol coherente, sin incumplimientos.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/grabaciones/ficha-serie
```
