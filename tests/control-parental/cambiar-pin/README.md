# [API][canoway][mutación] Cambiar el PIN de Jugendschutz y restaurarlo

| Campo | Valor |
|---|---|
| Jira | MULTISTC-76700 |
| Tipo | API · mutación (escritura) |
| Prioridad | Alta |
| Versión base | 26.10.100 |

## Qué hace
Prueba de escritura real contra el BFF, guiada por UI. En *Ajustes > PINs & Jugendschutz > PIN ändern* cambia el PIN de Jugendschutz a uno temporal, comprueba que el temporal es el vigente y **deja el PIN original**. Al final verifica que el original vuelve a ser válido (con la petición de PIN de *Profil hinzufügen*, que se cierra sin crear nada).

## Endpoints afectados
- `GET blender/service3.0/UserService.svc/ValidatePin?pinType=1&pin=…` (comprobar el PIN actual)
- `GET blender/service3.0/UserService.svc/ChangePin?pinType=1&pin=…&newPin=…` (cambiar el PIN)
- `GET blender/service3.0/UserService.svc/CheckPin?pinType=1&pin=…` (petición de PIN de *Profil hinzufügen*, comprobación final)

## Pantallas / funcionalidad afectada
- Ajustes > PINs & Jugendschutz (diálogo *Jugendschutz-PIN ändern*) y la petición de PIN de *Profil hinzufügen*.

## Precondiciones
- `API_ALLOW_MUTATIONS=true` (si no, se omite).
- Sesión guardada (proyecto `auth`).
- PIN original de la cuenta en `PARENTAL_PIN` del `.env` local (nunca en el repo; sin él la prueba se omite); PIN temporal en `PARENTAL_PIN_TEMP` (por defecto `2580`). Si el original no es correcto, la prueba falla en el primer paso sin cambiar nada (un intento fallido de PIN).

## Datos y mocks
- Sin mocks: escritura real en prod. Deja el mismo PIN que tenía la cuenta. Los PIN no aparecen en logs ni anotaciones.

## Resultado esperado
- `ValidatePin` acepta el original, `ChangePin` responde `Content=true`.
- Al restaurar, `ValidatePin` acepta el temporal y `ChangePin` vuelve al original.
- Al final, el original vuelve a ser válido.

## Cómo ejecutar
```
API_ALLOW_MUTATIONS=true npx playwright test --project=mutations tests/control-parental/cambiar-pin
```
