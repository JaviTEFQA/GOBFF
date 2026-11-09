"""Lector de la captura en vivo (.live/<versión>/capture.json), equivalente a src/testing/live-capture.ts.

canoway firma CADA petición (la firma cambia por llamada y caduca en segundos), así que no se pueden
reenviar peticiones a mano: todas darían 401. El setup `live-capture` de Playwright (TS) abre un
navegador logado, deja que la app pida los datos y guarda cada respuesta 2xx en capture.json. Python
NO abre el navegador: lee ese fichero y valida las respuestas reales contra el esquema guardado.

Flujo: genera/actualiza la captura con `npm run live` (o `npm run test:api`) y luego `pytest`.
"""
import json
from typing import Any, Optional

from .config import APP_VERSION, live_capture_file


def load_live_capture(version: str = APP_VERSION) -> Optional[dict]:
    f = live_capture_file(version)
    if not f.exists():
        return None
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return None


def live_samples(capture: Optional[dict], endpoint_id: str) -> list[dict]:
    if not capture:
        return []
    return capture.get("endpoints", {}).get(endpoint_id, [])


def from_live(endpoint_id: str, version: str = APP_VERSION) -> tuple[bool, list[dict]]:
    """Carga la captura y devuelve (hay_captura, samples_del_endpoint). Úsalo con pytest.skip."""
    capture = load_live_capture(version)
    return capture is not None, live_samples(capture, endpoint_id)


def sample_body(sample: dict) -> Any:
    return sample.get("body")
