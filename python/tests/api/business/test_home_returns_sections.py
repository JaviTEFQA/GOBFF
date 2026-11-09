"""Negocio (espejo de home-returns-sections): la home (nsh/thematic-site-page-prio) devuelve
secciones usables. Valida la respuesta real capturada en vivo."""
import json

import pytest

from canoway.live_capture import from_live

HOME = "GET nsh/thematic-site-page-prio"


def _non_empty(v) -> bool:
    return isinstance(v, str) and v.strip() != ""


def _brief(v) -> str:
    return json.dumps(v, ensure_ascii=False)[:120]


@pytest.mark.business
@pytest.mark.smoke
@pytest.mark.readme("tests/home/secciones")
def test_home_devuelve_secciones_usables(soft):
    captured, samples = from_live(HOME)
    if not captured:
        pytest.skip('Sin captura en vivo: ejecuta "npm run test:api".')
    if not samples:
        pytest.skip(f"La web no llamó a {HOME} durante el recorrido.")

    body = samples[0]["body"]
    assert samples[0]["status"] == 200
    sections = body.get("thematicSite")
    assert isinstance(sections, list), f'"thematicSite" no es lista: {_brief(sections)}'
    assert sections, "home sin secciones"

    untyped = [_brief(s) for s in sections if not (isinstance(s, dict) and _non_empty(s.get("type")))]
    soft.check(not untyped, f"secciones sin type: {untyped[:5]}")

    bad = [_brief(s) for s in sections if isinstance(s, dict) and "contents" in s and not isinstance(s["contents"], list)]
    soft.check(not bad, f'secciones cuyo "contents" no es lista: {bad[:5]}')

    contents = [c for s in sections if isinstance(s, dict) and isinstance(s.get("contents"), list) for c in s["contents"]]
    assert contents, "ninguna sección tiene contenidos"

    # Las tarjetas de enlace (LNK…) no tienen título por diseño: se excluyen.
    cards = [c for c in contents if not (isinstance(c, dict) and isinstance(c.get("pid"), str) and c["pid"].startswith("LNK"))]
    assert cards, "la home solo trae enlaces, ninguna tarjeta de contenido"

    broken = [c for c in cards if not (isinstance(c, dict) and _non_empty(c.get("pid")) and _non_empty(c.get("title")))]
    soft.check(not broken, f"{len(broken)} tarjetas sin pid/título: {[_brief(c) for c in broken[:10]]}")
    soft.assert_all()
