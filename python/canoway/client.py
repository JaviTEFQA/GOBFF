"""Cliente HTTP de canoway: equivalente a src/client/canoway-client.ts.

- Reintenta lo transitorio (509, 502/503/504, errores de red) con backoff y Retry-After.
- 401/403 -> renueva la sesión una vez y repite.
- Registra cada llamada para adjuntarla como evidencia.
"""
import json as _json
import re
import time
from dataclasses import dataclass, field
from typing import Any, Optional
from urllib.parse import urlencode

import requests

from .config import APP_VERSION, CANOWAY_BASE_URL
from .session import get_session

TRANSIENT = {502, 503, 504, 509}


@dataclass
class CanowayResponse:
    method: str
    url: str
    status: int
    headers: dict
    text: str
    json: Any
    duration_ms: int
    attempts: int

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300


@dataclass
class CanowayClient:
    http: requests.Session = field(default_factory=requests.Session)
    log: list = field(default_factory=list)
    _session: Optional[dict] = None

    def _resolve(self, url: str, query: Optional[dict]) -> str:
        full = url if re.match(r"^https?:", url) else f"{CANOWAY_BASE_URL}/{url.lstrip('/')}"
        query = dict(query or {})
        # La web manda ?appVersion=<versión> y el BFF responde según la versión que llama
        # ("26.10.100-CC" frente a "26.06.100-RA"): sin él se probaría el comportamiento antiguo.
        if "appVersion=" not in full and "appVersion" not in query:
            query["appVersion"] = APP_VERSION
        if query:
            full += ("&" if "?" in full else "?") + urlencode({k: str(v) for k, v in query.items()})
        return full

    def get(self, url: str, query: Optional[dict] = None) -> CanowayResponse:
        return self.send(url=url, query=query)

    def send(self, url: str, method: str = "GET", query: Optional[dict] = None, body: Any = None,
             headers: Optional[dict] = None, anonymous: bool = False, retries: int = 2) -> CanowayResponse:
        method = method.upper()
        full_url = self._resolve(url, query)
        reauthed = False
        attempts = 0

        while True:
            attempts += 1
            if not anonymous and self._session is None:
                self._session = get_session()
            hdrs = {**({} if anonymous else self._session["headers"]), **(headers or {})}
            data = None if body is None else (body if isinstance(body, str) else _json.dumps(body))
            if data is not None and not any(h.lower() == "content-type" for h in hdrs):
                hdrs["content-type"] = "application/json"

            started = time.monotonic()
            try:
                res = self.http.request(method, full_url, headers=hdrs, data=data, timeout=30)
            except requests.RequestException as e:
                if attempts <= retries:
                    time.sleep(0.4 * 2 ** (attempts - 1))
                    continue
                raise RuntimeError(f"canoway {method} {full_url} network error after {attempts} attempts: {e}") from e
            duration_ms = int((time.monotonic() - started) * 1000)

            if res.status_code in (401, 403) and not anonymous and not reauthed:
                reauthed = True
                self._session = get_session(force_refresh=True)
                continue
            if res.status_code in TRANSIENT and attempts <= retries:
                try:
                    wait = min(float(res.headers.get("retry-after", "")), 5.0)
                except ValueError:
                    wait = 0.4 * 2 ** (attempts - 1)
                time.sleep(wait if wait > 0 else 0.4 * 2 ** (attempts - 1))
                continue

            try:
                parsed = res.json() if res.text else None
            except ValueError:
                parsed = None
            out = CanowayResponse(method, full_url, res.status_code, dict(res.headers), res.text, parsed,
                                  duration_ms, attempts)
            self.log.append(out)
            return out
