# [Fichas][negocio] Ficha deportiva: isSport

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76680 |
| Tipo | API · negocio |
| Historias | GO-36571 |
| TCs manuales que automatiza | MULTISTC-67886, 67887, 67888, 67889, 67891 |
| Versión base | 26.10.100 |

## Qué hace
En las fichas LSR, `isSport` es booleano. Con isSport=true: cada season trae title, los botones de grabar serie y temporada no se muestran y, con renderChild=true, el episodio relevante no se repite en la temporada.

## Endpoints afectados
- `GET nsh/unified-detailed/{pid}`

## Pantallas / funcionalidad afectada
- Ficha de una competición deportiva en directo (agrupación por temporadas/jornadas).

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Los contenidos los elige la navegación de la app.
- Si la captura no abre ninguna LSR deportiva, las reglas de isSport=true se anotan como "sin datos". 67890 y 67892 dependen de datos preparados (pid relevante fuera de la temporada, descripción vacía).

## Resultado esperado
- isSport booleano; reglas deportivas cuando es true.
- Las aserciones son *soft*: el informe lista todos los incumplimientos, y las anotaciones dicen qué datos había.

## Cómo ejecutar
```
npx playwright test tests/fichas/deportes
```
