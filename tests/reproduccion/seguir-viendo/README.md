# [API][canoway][mutación] Seguir viendo: reproducir, reanudar y quitar

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76702 |
| Tipo | API · mutación (escritura) |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Prueba de escritura real contra el BFF, guiada por UI y con reproducción DRM de verdad. Abre la ficha de una película de la Mediathek sin punto de reanudación, pulsa *Sehen* y deja reproducir unos 45 s. Comprueba que la ficha guarda el punto (`playback.resume.time > 0`) y ofrece *Fortsetzen* / *Fertig*. Al terminar la **quita** de seguir viendo (*Fertig > Ok*) y comprueba que vuelve al estado inicial. Patrón hacer → verificar → deshacer.

## Endpoints afectados
- `GET playback/information` (datos de reproducción) y licencia Widevine (`wvls/DashIssuer.aspx`)
- `GET nsh/unified-detailed/{pid}` (verificación: `playback.resume`, `buttons.isStopWatchingVisible`, `tags.watched`)
- `DELETE nsh/personal-contents` (`{contentPids:[pid], actionTypeId:1}`: quitar de seguir viendo)

## Pantallas / funcionalidad afectada
- Ficha de película (*Sehen*, *Fortsetzen*, *Neustart*, *Fertig*), reproductor y rail de seguir viendo.

## Precondiciones
- `API_ALLOW_MUTATIONS=true` (si no, se omite).
- Sesión guardada (proyecto `auth`).
- **Chrome instalado** en la máquina: la prueba usa `src/testing/widevine.ts` (Chrome con perfil propio y sin `--disable-component-update`), porque el Chromium de Playwright no trae Widevine. Si el navegador no tiene Widevine, se omite.
- Alguna película de la Mediathek sin punto de reanudación.

## Datos y mocks
- Sin mocks: reproducción y escritura reales en prod. Consume una sesión de streaming mientras reproduce. Solo usa una película que no estaba en seguir viendo y la deja como estaba (sin resume, `watched=false`).

## Resultado esperado
- El vídeo avanza al menos 45 s sin error de DRM.
- Tras reproducir, la ficha marca `resume.time > 0`, `isStopWatchingVisible=true` y `tags.watched=true`.
- *Fertig* responde 2xx y la película vuelve a no tener resume ni `watched`.

## Cómo ejecutar
```
API_ALLOW_MUTATIONS=true npx playwright test --project=mutations tests/reproduccion/seguir-viendo
```
