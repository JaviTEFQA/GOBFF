"""Seguridad (espejo de tests/perfiles/sin-token): los endpoints privados rechazan
las llamadas sin token.

Control: con la respuesta capturada en vivo se comprueba que CON la sesión del usuario el endpoint
responde 2xx (si no, un endpoint caído pasaría por "seguro"). Luego, una llamada DIRECTA sin token
debe dar 401/403.

No hay prueba de "firma falsa": canoway firma cada petición y cualquier reenvío (también el de una
cabecera válida) da 401, así que no se podría distinguir de una caducada.
"""
import pytest

from canoway.live_capture import from_live

PRIVATE = [
    ("nsh/profiles", "GET nsh/profiles"),
    ("nsh/recordings", "GET nsh/recordings"),
    ("nsh/recordings/storage-info", "GET nsh/recordings/storage-info"),
]

pytestmark = [
    pytest.mark.security,
    pytest.mark.readme("tests/perfiles/sin-token"),
    pytest.mark.parametrize("url,endpoint_id", PRIVATE),
]


def test_con_sesion_responde_2xx_control(url, endpoint_id):
    captured, samples = from_live(endpoint_id)
    if not captured:
        pytest.skip('Sin captura en vivo: ejecuta "npm run live" o "npm run test:api".')
    if not samples:
        pytest.skip(f"La web no llamó a {endpoint_id} durante el recorrido: no hay control.")
    status = samples[0]["status"]
    assert 200 <= status < 300, f"{endpoint_id} respondió {status} CON sesión"


def test_rechaza_sin_token(canoway, url, endpoint_id):
    # Los transitorios (509/5xx) los reintenta el cliente; 401/403 nunca.
    res = canoway.send(url=url, anonymous=True)
    assert res.status in (401, 403), f"{url} respondió {res.status} sin token: {res.text[:200]}"
