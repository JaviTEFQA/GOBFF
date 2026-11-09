"""Sesión de canoway.

No se reimplementa el login O2 SSO en Python: se reutiliza .auth/canoway-session.json,
que genera el proyecto `auth` del framework TS. Si no existe o el JWT ha caducado,
se lanza `npx playwright test --project=auth` para renovarla.
"""
import base64
import json
import re
import shutil
import subprocess
import time
from typing import Optional

from .config import ROOT, SESSION_FILE

JWT_RE = re.compile(r"eyJ[\w-]+\.([\w-]+)\.[\w-]+")
MARGIN_MS = 2 * 60_000
FALLBACK_TTL_MS = 30 * 60_000


def jwt_expiry(value: str) -> Optional[int]:
    m = JWT_RE.search(value)
    if not m:
        return None
    try:
        payload = m.group(1) + "=" * (-len(m.group(1)) % 4)
        exp = json.loads(base64.urlsafe_b64decode(payload)).get("exp")
        return exp * 1000 if exp else None
    except Exception:
        return None


def _load() -> Optional[dict]:
    try:
        return json.loads(SESSION_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _is_valid(s: Optional[dict]) -> bool:
    if not s:
        return False
    exp = s.get("expiresAt") or (s.get("capturedAt", 0) + FALLBACK_TTL_MS)
    return time.time() * 1000 < exp - MARGIN_MS


def _harvest(force: bool) -> None:
    if force and SESSION_FILE.exists():
        SESSION_FILE.unlink()  # el proyecto auth reutiliza la sesión si sigue en disco
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not npx:
        raise RuntimeError("npx no encontrado: hace falta Node para capturar la sesión (npm run auth).")
    subprocess.run([npx, "playwright", "test", "--project=auth"], cwd=ROOT, check=True)


def forge_signature(value: str) -> str:
    """El mismo token con la firma falsificada: cabecera y payload intactos, firma invertida."""
    return re.sub(r"(eyJ[\w-]+\.[\w-]+\.)([\w-]+)", lambda m: m.group(1) + m.group(2)[::-1], value, count=1)


_forced_once = False


def get_session(force_refresh: bool = False) -> dict:
    """Sesión válida de disco, o una captura nueva.

    `force_refresh` (tras un 401/403) solo re-captura UNA vez por proceso: si canoway sigue
    rechazando la sesión recién capturada, re-capturar en bucle no lo arregla y cada captura
    es un login contra el SSO de O2, que bloquea la cuenta tras varios seguidos.
    """
    global _forced_once
    cached = _load()
    if force_refresh and _forced_once:
        if cached:
            return cached
        raise RuntimeError("La sesión ya se renovó una vez en esta ejecución y canoway la sigue rechazando.")
    if not force_refresh and _is_valid(cached):
        return cached
    if force_refresh:
        _forced_once = True
    _harvest(force_refresh)
    session = _load()
    if not session:
        raise RuntimeError(f"No se pudo obtener la sesión ({SESSION_FILE}).")
    return session
