"""Configuración: mismos .env que el framework TS (BFF/.env y, como respaldo, ../ai-playwright-agent/.env)."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]  # BFF/

_local_env = ROOT / ".env"
_web_env = ROOT.parent / "ai-playwright-agent" / ".env"
# Se leen los dos: BFF/.env primero (gana) y el del proyecto web completa lo que falte (credenciales).
for _f in (_local_env, _web_env):
    if _f.exists():
        load_dotenv(_f)


def _str(name: str, fallback: str = "") -> str:
    return os.environ.get(name, fallback).strip()


def _num(name: str, fallback: int) -> int:
    try:
        v = int(os.environ.get(name, ""))
        return v if v > 0 else fallback
    except ValueError:
        return fallback


CANOWAY_BASE_URL = _str("CANOWAY_BASE_URL", "https://canoway-de.cdn.telefonica.com/instance/45/service").rstrip("/")
APP_VERSION = _str("APP_VERSION", "26.10.100")
# Versión del contrato contra la que validar. Vacío = la propia. Al llegar una versión nueva se
# captura con APP_VERSION=<nueva> y se valida contra CONTRACT_BASELINE=<anterior> (ver qué rompe).
CONTRACT_BASELINE = _str("CONTRACT_BASELINE")
LATENCY_BUDGET_MS = _num("API_LATENCY_BUDGET_MS", 3000)

ALLOW_MUTATIONS = _str("API_ALLOW_MUTATIONS", "false") == "true"

# La sesión la captura el proyecto `auth` de Playwright (TS). Python solo la reutiliza.
SESSION_FILE = ROOT / ".auth" / "canoway-session.json"

# Mismas grabaciones y contratos que el framework TS.
RECORDINGS_DIR = ROOT / "recordings"
CONTRACTS_DIR = ROOT / "contracts"
CONTRACT_OVERRIDES = CONTRACTS_DIR / "overrides.json"

# Captura en vivo que genera el setup `live-capture` de Playwright (TS). Python la LEE (no puede
# abrir el navegador firmado): canoway firma cada petición, así que las pruebas validan las
# respuestas reales que pidió la app. Ver src/testing/live-capture.ts.
LIVE_DIR = ROOT / ".live"


def live_capture_file(version: str = APP_VERSION) -> Path:
    return LIVE_DIR / version / "capture.json"
