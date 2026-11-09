"""Autotests offline del framework Python (sin red ni credenciales)."""
import base64
import json

import pytest

from canoway.contracts import endpoint_slug, json_type, validate
from canoway.fresh_data import collect_pids, home_card_pids
from canoway.session import forge_signature, jwt_expiry

pytestmark = pytest.mark.unit

# Mismo contrato que inferiría TS de los samples de tests/unit/shape.spec.ts
SHAPE = {
    "types": ["object"], "required": ["home"],
    "properties": {"home": {"types": ["array"], "items": {
        "types": ["object"], "required": ["contents", "title", "type"],
        "properties": {
            "type": {"types": ["string"]},
            "title": {"types": ["null", "string"]},
            "contents": {"types": ["array"], "items": {
                "types": ["object"], "required": ["pid", "title"],
                "properties": {
                    "pid": {"types": ["string"]}, "title": {"types": ["string"]},
                    "triangles": {"types": ["object"], "required": ["isTvod"],
                                  "properties": {"isTvod": {"types": ["boolean"]}}},
                }}},
        }}}},
}


def test_valid_response_passes():
    ok = {"home": [{"type": "live", "title": None, "contents": [{"pid": "EPI1234", "title": "C"}]}]}
    assert [v for v in validate(ok, SHAPE) if v["kind"] != "added"] == []


def test_removed_field_and_changed_type_break_new_field_does_not():
    v = validate({"home": [{"type": "live", "title": "x", "contents": [{"pid": 123, "extra": 1}]}]}, SHAPE)
    assert {"path": "$.home[].contents[].title", "kind": "missing", "expected": "string"} in v
    assert {"path": "$.home[].contents[].pid", "kind": "type", "expected": "string", "actual": "number"} in v
    assert {"path": "$.home[].contents[].extra", "kind": "added", "actual": "number"} in v


def test_bool_is_not_a_number():
    assert json_type(True) == "boolean"
    v = validate({"home": [{"type": "x", "title": "y", "contents": [{"pid": "M", "title": "t", "triangles": {"isTvod": 1}}]}]}, SHAPE)
    assert {"path": "$.home[].contents[].triangles.isTvod", "kind": "type", "expected": "boolean", "actual": "number"} in v


def test_overrides_make_a_path_optional():
    v = validate({"home": [{"type": "x", "title": "y", "contents": [{"pid": "MOV1"}]}]}, SHAPE, ["$.home[].contents[].title"])
    assert [x for x in v if x["kind"] != "added"] == []


def test_repeated_violations_are_reported_once():
    v = validate({"home": [{"type": "x", "title": "y", "contents": [{"pid": 1, "title": "a"}, {"pid": 2, "title": "b"}]}]}, SHAPE)
    assert len([x for x in v if x["path"] == "$.home[].contents[].pid"]) == 1


def test_endpoint_slug_matches_typescript():
    assert endpoint_slug("GET nsh/unified-detailed-content/{pid}") == "GET__nsh_unified-detailed-content_pid"
    assert endpoint_slug("GET nsh/home") == "GET__nsh_home"


def test_home_card_pids_only_takes_cards():
    home = {"home": [
        {"type": "carousel", "image": "IMG12345", "contents": [{"pid": "EDI1001", "content": {"pid": "MOV2002"}}, {"pid": "SER3003"}]},
        {"type": "live", "channel": "CHA9999", "contents": [{"pid": "MOV2002"}, {"pid": 42}, {"pid": "not-a-pid"}]},
        {"type": "empty"}, None,
    ]}
    assert home_card_pids(home) == ["EDI1001", "MOV2002", "SER3003"]
    assert home_card_pids(None) == [] and home_card_pids({"home": "x"}) == []


def test_collect_pids_groups_by_prefix_in_order():
    assert collect_pids({"a": ["SER0001", "MOV123", {"b": "MOV123"}], "c": "abc"}) == {"SER": {"SER0001": None}, "MOV": {"MOV123": None}}


def _jwt(payload: dict) -> str:
    enc = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
    return f"Bearer {enc({'alg': 'HS256'})}.{enc(payload)}.c2lnbmF0dXJl"


def test_jwt_expiry_and_forged_signature():
    token = _jwt({"exp": 2_000_000_000})
    assert jwt_expiry(token) == 2_000_000_000_000
    forged = forge_signature(token)
    assert forged != token and forged.rsplit(".", 1)[0] == token.rsplit(".", 1)[0]
    assert forge_signature("not a jwt") == "not a jwt"


def test_samples_one_per_kind_of_content():
    from canoway.recordings import request_shape, samples_for
    eid = "GET nsh/unified-detailed-content/{pid}"
    ex = lambda p, s=200: {"endpointId": eid, "key": f"GET nsh/unified-detailed-content/{p}", "response": {"status": s}}
    assert request_shape("GET nsh/unified-detailed-content/MOV123456?lang=de") == "GET nsh/unified-detailed-content/MOV?lang="
    all_ = [ex(p) for p in ("MOV1001", "MOV1002", "SER2001", "LSC3001", "LSR4001", "REC5001")] + [ex("EPI6001", 500)]
    picked = [e["key"].rsplit("/", 1)[1] for e in samples_for(all_, eid, 3)]
    assert picked == ["MOV1001", "SER2001", "LSC3001", "LSR4001", "REC5001"]
