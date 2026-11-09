# [API][canoway][mutación] Crear un perfil y borrarlo

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76701 |
| Tipo | API · mutación (escritura) |
| Prioridad | Media |
| Versión base | 26.10.100 |

## Qué hace
Prueba de escritura real contra el BFF, guiada por UI. En la pantalla de perfiles pulsa *Profil hinzufügen*, introduce el Jugendschutz-PIN, elige avatar y crea el perfil **QA BFF &lt;hhmm&gt;**; verifica que aparece en `nsh/profiles` y lo **borra** al terminar (*ändern > Löschen > Fortsetzen*).

## Endpoints afectados
- `GET blender/service3.0/UserService.svc/CheckPin` (PIN para crear perfil)
- Alta del perfil (`POST`/`PUT` en `nsh/profiles`)
- `GET nsh/profiles` (verificación)
- `DELETE nsh/profiles/{id}` (borrado)

## Pantallas / funcionalidad afectada
- Selección de perfil (*Wähle dein Profil*), alta (*Avatar auswählen*, *Profil erstellen*) y edición del perfil.

## Precondiciones
- `API_ALLOW_MUTATIONS=true` (si no, se omite).
- Sesión guardada (proyecto `auth`).
- Jugendschutz-PIN en `PARENTAL_PIN` del `.env` local (nunca en el repo; sin él la prueba se omite).
- La cuenta admite un perfil más (`isProfileAddEnabled=true`; con 5 perfiles se omite).

## Datos y mocks
- Sin mocks: escritura real en prod. Solo crea y borra su propio perfil (nombre único); no toca los perfiles existentes.

## Resultado esperado
- El alta responde 2xx y el perfil aparece en `nsh/profiles` (no como perfil por defecto).
- El borrado responde 2xx y el perfil desaparece.

## Cómo ejecutar
```
API_ALLOW_MUTATIONS=true npx playwright test --project=mutations tests/perfiles/crear-borrar
```
