"""Ids vivos para pruebas: equivalente a src/testing/fresh-data.ts."""
import re
from typing import Any, Optional

PID_RE = re.compile(r"^[A-Z]{2,5}\d{3,}$")

# Fuentes vivas donde buscar ids, en orden; se para en la primera que da el prefijo.
FRESH_ID_SOURCES = ["nsh/thematic-site-page-prio", "nsh/home", "nsh/menu", "nsh/channels/userOrder", "nsh/recordings"]


def _is_pid(v: Any) -> bool:
    return isinstance(v, str) and bool(PID_RE.match(v))


def collect_pids(value: Any, acc: Optional[dict] = None) -> dict:
    """Todos los strings con forma de PID del JSON, agrupados por prefijo (dict ordenado = Set de JS)."""
    if acc is None:
        acc = {}
    if _is_pid(value):
        acc.setdefault(re.match(r"^[A-Z]+", value).group(0), {})[value] = None
    elif isinstance(value, list):
        for v in value:
            collect_pids(v, acc)
    elif isinstance(value, dict):
        for v in value.values():
            collect_pids(v, acc)
    return acc


def home_card_pids(home: Any) -> list:
    """Ids que el usuario puede abrir desde la home: `home[].contents[].pid` y `.content.pid`,
    en orden de pantalla y sin duplicados. No recoge ids de imágenes, canales o metadatos."""
    out: dict = {}
    sections = home.get("home") if isinstance(home, dict) else None
    if not isinstance(sections, list):
        return []
    for s in sections:
        contents = s.get("contents") if isinstance(s, dict) else None
        if not isinstance(contents, list):
            continue
        for c in contents:
            if not isinstance(c, dict):
                continue
            inner = c.get("content") if isinstance(c.get("content"), dict) else {}
            for pid in (c.get("pid"), inner.get("pid")):
                if _is_pid(pid):
                    out[pid] = None
    return list(out)


def fresh_pids(canoway, prefix: str) -> list:
    """PIDs vivos de la home (y después menú, canales, grabaciones si la home no tiene ese prefijo)."""
    found: dict = {}
    for url in FRESH_ID_SOURCES:
        try:
            res = canoway.get(url)
        except RuntimeError:
            continue
        if res.json is not None:
            collect_pids(res.json, found)
        if found.get(prefix):
            break
    return list(found.get(prefix, {}))
