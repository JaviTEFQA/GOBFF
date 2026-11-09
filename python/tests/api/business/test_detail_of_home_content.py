"""Negocio (espejo de detail-of-home-content): cada ficha (nsh/unified-detailed/{pid}) describe su
propio contenido. Valida las respuestas reales capturadas en vivo al abrir fichas."""
import re

import pytest

from canoway.live_capture import from_live

DETAIL = "GET nsh/unified-detailed/{pid}"
PID_RE = re.compile(r"/([A-Z]{2,5}\d{3,})(?=/|$|\?)")


def _non_empty(v) -> bool:
    return isinstance(v, str) and v.strip() != ""


@pytest.mark.business
@pytest.mark.smoke
@pytest.mark.readme("tests/fichas/propio-contenido")
def test_cada_ficha_describe_su_propio_contenido(soft, record_property):
    captured, samples = from_live(DETAIL)
    if not captured:
        pytest.skip('Sin captura en vivo: ejecuta "npm run test:api".')
    if not samples:
        pytest.skip(f"La web no abrió ninguna ficha {DETAIL} durante el recorrido.")

    pids = [m.group(1) for s in samples if (m := PID_RE.search(s["url"]))]
    record_property("pids", ", ".join(pids))

    # Soft: se comprueban todos los tipos; una película rota no oculta una serie rota.
    for sample in samples:
        m = PID_RE.search(sample["url"])
        pid = m.group(1) if m else sample["url"]
        if not soft.check(sample["status"] == 200, f"{pid}: status {sample['status']}"):
            continue
        if not sample.get("isJson"):
            continue
        body = sample["body"]
        soft.check(isinstance(body, dict) and body.get("pid") == pid,
                   f"la ficha de {pid} describe {body.get('pid')!r}" if isinstance(body, dict) else f"{pid}: la ficha no es un objeto")
        if isinstance(body, dict):
            soft.check(_non_empty(body.get("title")), f"la ficha de {pid} no tiene título")
    soft.assert_all()
