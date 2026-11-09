"""Lectura de grabaciones (recordings/<versión>/<slug>/<hash>.json). Equivalente a src/recordings/store.ts."""
import json
import re

from .config import APP_VERSION, RECORDINGS_DIR


def load_exchanges(version: str = APP_VERSION) -> list:
    root = RECORDINGS_DIR / version
    if not root.exists():
        return []
    out = []
    for f in sorted(root.glob("*/*.json")):
        try:
            out.append(json.loads(f.read_text(encoding="utf-8")))
        except (OSError, ValueError):
            continue  # grabación corrupta: no tumba la recolección del resto
    return sorted(out, key=lambda e: (e["endpointId"], e["key"]))


MAX_DISTINCT_SHAPES = 8


def request_shape(key: str) -> str:
    """Query sin valores y PIDs reducidos a su tipo: MOV… y SER… son formas distintas; dos MOV, la misma."""
    return re.sub(r"\b([A-Z]{2,5})\d{3,}\b", r"\1", re.sub(r"=[^&]*", "=", key))


def samples_for(exchanges: list, endpoint_id: str, max_samples: int = 3) -> list:
    """Variedad primero: una muestra por forma distinta (tipo de contenido, query), después el resto."""
    seen, distinct, rest = set(), [], []
    for e in exchanges:
        if e["endpointId"] != endpoint_id or e["response"]["status"] >= 400:
            continue
        shape = request_shape(e["key"])
        (rest if shape in seen else distinct).append(e)
        seen.add(shape)
    variety = distinct[:MAX_DISTINCT_SHAPES]
    return (variety + distinct[MAX_DISTINCT_SHAPES:] + rest)[:max(max_samples, len(variety))]
