"""Fixtures de pytest: equivalente a src/testing/fixtures.ts.

- `canoway`: un cliente HTTP NUEVO por test (sin estado compartido; solo la sesión, de lectura).
- Las llamadas hechas por cada test se guardan en el informe (junit/html) como propiedad
  `canoway-calls`, y la clave Jira del README del test (si la hay) como propiedad `jira`.
"""
import json
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))

from canoway.client import CanowayClient  # noqa: E402
from canoway.config import ROOT  # noqa: E402

JIRA_RE = re.compile(r"\|\s*Jira\s*\|\s*([A-Z][A-Z0-9]+-\d+)")


@pytest.fixture
def canoway(request):
    client = CanowayClient()
    yield client
    if client.log:
        calls = [
            {"method": c.method, "url": c.url, "status": c.status, "durationMs": c.duration_ms, "attempts": c.attempts}
            for c in client.log
        ]
        request.node.user_properties.append(("canoway-calls", json.dumps(calls)))
        retried = [f"{c.url} ({c.attempts})" for c in client.log if c.attempts > 1]
        if retried:
            request.node.user_properties.append(("retried-calls", ", ".join(retried)))
    client.http.close()


class Soft:
    """Aserciones blandas (como expect.soft): acumula fallos y los informa todos juntos."""

    def __init__(self):
        self.failures: list = []
        self.reported = False

    def check(self, condition, message: str) -> bool:
        if not condition:
            self.failures.append(message)
        return bool(condition)

    def assert_all(self) -> None:
        self.reported = True
        assert not self.failures, f"{len(self.failures)} fallo(s):\n- " + "\n- ".join(self.failures)


@pytest.fixture
def soft():
    s = Soft()
    yield s
    # Red de seguridad: si el test olvidó llamar a assert_all(), los fallos no se pierden.
    if s.failures and not s.reported:
        pytest.fail("soft failures not asserted:\n- " + "\n- ".join(s.failures))


@pytest.fixture(autouse=True)
def _jira_context(request):
    """El README de la carpeta del test TS correspondiente (marcador `readme`) aporta la clave Jira."""
    marker = request.node.get_closest_marker("readme")
    if marker:
        readme = ROOT / marker.args[0] / "README.md"
        if readme.exists():
            request.node.user_properties.append(("readme", str(readme.relative_to(ROOT))))
            m = JIRA_RE.search(readme.read_text(encoding="utf-8"))
            if m:
                request.node.user_properties.append(("jira", m.group(1)))
    yield
