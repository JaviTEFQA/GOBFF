# canoway BFF — pruebas de API en Python

Versión Python (pytest + requests) de las pruebas de API del framework TS. Comparte con él:

- la **sesión** (`.auth/canoway-session.json`): la captura el proyecto `auth` de Playwright; si falta o caduca, se lanza `npx playwright test --project=auth` automáticamente;
- las **grabaciones** (`recordings/<versión>/`) y los **contratos** (`contracts/<versión>/`, `contracts/overrides.json`): TS y Python validan contra el mismo esquema guardado;
- los **README** de cada caso (`tests/api/...`), de los que se toma la clave Jira.

```bash
cd python
pip install -r requirements.txt
pytest -m unit         # autotests offline
pytest -m smoke        # negocio rápido contra canoway real
pytest -m contract     # contrato de todos los endpoints grabados (requiere npm run record + contracts:build)
pytest                 # todo
```

| Carpeta | Qué prueba |
|---|---|
| `tests/unit` | validador de contratos, ids de la home, JWT, muestreo (sin red) |
| `tests/api/contract` | cada petición grabada contra canoway real, validada con el contrato guardado (una muestra por tipo de contenido) |
| `tests/api/business` | home utilizable; las cards de la home abren su ficha |
| `tests/api/security` | endpoints privados: control con token, rechazo sin token y con firma JWT falsificada |

Resultados en `../test-results/pytest-junit.xml` (con las llamadas a canoway, pids usados y clave Jira como propiedades).
