"""Regresión de contrato (espejo de src/testing/contract-test.ts) sobre la captura en vivo.

canoway firma cada petición y no se pueden reenviar: se validan las respuestas reales que pidió la
app, guardadas por el setup `live-capture` (TS) en .live/<versión>/capture.json. Por cada endpoint y
cada "shape" (tipo de contenido / query) capturada:
  1. hubo respuesta 2xx;
  2. el cuerpo JSON cumple contracts/<versión>/<slug>.json (campo que falta o cambia de tipo ->
     FALLO; campo nuevo -> aviso);
  3. latencia: solo aviso (se mide en carga de página, con contención; no falla).

Genera/actualiza la captura con `npm run live` (o `npm run test:api`) antes de `pytest`.
"""
import warnings

import pytest

from canoway.config import APP_VERSION, CONTRACT_BASELINE, LATENCY_BUDGET_MS
from canoway.contracts import load_contract, load_overrides, validate
from canoway.live_capture import load_live_capture

# GETs que cambian la sesión (perfil activo, tokens): no se validan. Igual que SESSION_ENDPOINTS en TS.
SESSION_ENDPOINTS = {"GET users/switchProfile"}

_CAPTURE = load_live_capture(APP_VERSION)


def _cases():
    if not _CAPTURE:
        return [pytest.param(None, None, id="sin-captura",
                             marks=pytest.mark.skip(reason='Sin captura en vivo: ejecuta "npm run live" o "npm run test:api".'))]
    cases = []
    for endpoint_id, samples in sorted(_CAPTURE.get("endpoints", {}).items()):
        if endpoint_id in SESSION_ENDPOINTS:
            continue
        for sample in samples:
            cases.append(pytest.param(endpoint_id, sample, id=sample["key"]))
    if not cases:
        return [pytest.param(None, None, id="captura-vacia",
                             marks=pytest.mark.skip(reason="La captura en vivo no tiene endpoints."))]
    return cases


@pytest.mark.contract
@pytest.mark.parametrize("endpoint_id,sample", _cases())
def test_contract(soft, record_property, endpoint_id, sample):
    override = load_overrides().get(endpoint_id, {})
    method = endpoint_id.split(" ")[0]

    status = sample["status"]
    assert 200 <= status < 300, f'{method} {sample["url"]} -> {status}'

    if not override.get("skipContract") and sample.get("isJson"):
        # Por defecto se valida contra el contrato de la propia versión; con CONTRACT_BASELINE,
        # contra el de una versión anterior (comprobar que la nueva no rompe la previa).
        contract_version = CONTRACT_BASELINE or APP_VERSION
        shape = load_contract(endpoint_id, contract_version)
        assert shape is not None, 'contrato no encontrado: ejecuta "npm run contracts:build"'
        violations = validate(sample["body"], shape, override.get("optional", []))
        added = [v["path"] for v in violations if v["kind"] == "added"]
        breaking = [v for v in violations if v["kind"] != "added"]
        if added:
            record_property("contract-added-fields", ", ".join(added[:30]))
        soft.check(not breaking, f"cambios que rompen el contrato de {contract_version}:\n" + "\n".join(
            f"  {v['kind']} {v['path']} (esperado {v.get('expected', '-')}, obtenido {v.get('actual', 'ausente')})"
            for v in breaking))

    budget = override.get("latencyBudgetMs", LATENCY_BUDGET_MS)
    dur = sample.get("durationMs")
    if dur is not None and dur > budget:
        warnings.warn(f"{endpoint_id}: {dur} ms > presupuesto {budget} ms (medido en carga de página)")
    soft.assert_all()
