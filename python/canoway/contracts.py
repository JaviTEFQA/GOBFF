"""Contratos: carga y validación. Equivalente a src/contracts/shape.ts (validate) y registry.ts.

Los contratos los infiere el framework TS (`npm run contracts:build`) en
contracts/<versión>/<slug>.json; Python lee exactamente los mismos ficheros,
así TS y Python validan contra el mismo esquema guardado.

    missing / type  -> rompe a un consumidor -> FALLO
    added           -> campo nuevo           -> solo aviso
"""
import json
import re
from typing import Any, Optional

from .config import APP_VERSION, CONTRACTS_DIR, CONTRACT_OVERRIDES

MAX_ARRAY_ITEMS = 300


def json_type(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):  # antes que int: en Python bool es subclase de int
        return "boolean"
    if isinstance(v, (int, float)):
        return "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    return "object"


def endpoint_slug(endpoint_id: str) -> str:
    s = re.sub(r"^(\w+) ", r"\1__", endpoint_id, count=1)
    s = re.sub(r"[{}]", "", s)
    s = re.sub(r'[/\\:*?"<>|. ]+', "_", s)
    return re.sub(r"_+$", "", s) or "root"


def _is_optional(path: str, optional: list) -> bool:
    return any(p == path or (p.endswith("*") and path.startswith(p[:-1])) for p in optional)


def validate(value: Any, shape: dict, optional: Optional[list] = None, path: str = "$") -> list:
    optional = optional or []
    t = json_type(value)
    if t not in shape["types"]:
        if t == "null" and _is_optional(path, optional):
            return []
        return [{"path": path, "kind": "type", "expected": "|".join(shape["types"]), "actual": t}]

    out = []
    if t == "array" and shape.get("items"):
        for item in value[:MAX_ARRAY_ITEMS]:
            out += validate(item, shape["items"], optional, f"{path}[]")
    if t == "object":
        if shape.get("mapValues"):
            for v in value.values():
                out += validate(v, shape["mapValues"], optional, f"{path}{{}}")
        elif shape.get("properties") is not None:
            props = shape["properties"]
            for k in shape.get("required", []):
                p = f"{path}.{k}"
                if k not in value and not _is_optional(p, optional):
                    out.append({"path": p, "kind": "missing", "expected": "|".join(props.get(k, {}).get("types", []))})
            for k, v in value.items():
                p = f"{path}.{k}"
                if k in props:
                    out += validate(v, props[k], optional, p)
                else:
                    out.append({"path": p, "kind": "added", "actual": json_type(v)})
    return _dedupe(out)


def _dedupe(vs: list) -> list:
    seen, out = set(), []
    for v in vs:
        k = (v["kind"], v["path"], v.get("expected"), v.get("actual"))
        if k not in seen:
            seen.add(k)
            out.append(v)
    return out


def load_contract(endpoint_id: str, version: str = APP_VERSION) -> Optional[dict]:
    f = CONTRACTS_DIR / version / f"{endpoint_slug(endpoint_id)}.json"
    if not f.exists():
        return None
    return json.loads(f.read_text(encoding="utf-8"))["shape"]


def load_overrides() -> dict:
    if not CONTRACT_OVERRIDES.exists():
        return {}
    return json.loads(CONTRACT_OVERRIDES.read_text(encoding="utf-8"))
