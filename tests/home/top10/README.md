# [API][canoway] El carrusel Top 10 no supera los 10 contenidos

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76649 |
| Tipo | API · negocio |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Busca en `nsh/thematic-site-page-prio` las secciones cuyo título sea un "Top …" y valida que traen entre 1 y 10 contenidos. Usa la respuesta real capturada en vivo.

## Endpoints afectados
- `GET nsh/thematic-site-page-prio`

## Pantallas / funcionalidad afectada
- Carrusel Top 10 de la home: si trae más de 10, el carrusel se pinta mal; si trae 0, desaparece.

## Precondiciones
- Cuenta O2 DE válida en `.env`; sesión y captura en vivo automáticas.

## Datos y mocks
- Datos vivos de canoway capturados por el navegador logado. Sin mocks. Si la home del momento no trae ningún carrusel "Top", la prueba se omite (no hay nada que validar).

## Resultado esperado
- Cada sección "Top …" trae de 1 a 10 contenidos (aserciones *soft*: se comprueban todas y se informa).

## Cómo ejecutar
```
npx playwright test tests/home/top10
```
