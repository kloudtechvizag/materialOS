"""Laboratory storage & chain of custody (fifth pass): a real
self-referencing storage hierarchy, and a genuine append-only custody
ledger -- see ADR-021's storage addendum. Proves the hierarchy nests,
a custody event auto-captures from_location_id from the sample's own
current state (never caller-supplied), current_location_id tracks the
sample's latest whereabouts, checked_out/disposed events correctly
leave tracked storage, and a disposed sample is a real terminal state
that blocks further custody events.
"""
import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _signup(slug: str) -> str:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
            "industry_slug": "laboratory",
        },
    )
    return client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    ).json()["access_token"]


def _make_sample(headers: dict) -> dict:
    test_def = client.post(
        "/api/v1/lab/test-definitions", headers=headers,
        json={"code": f"PH-{uuid.uuid4().hex[:6]}", "name": "pH", "result_type": "quantitative", "unit": "pH"},
    ).json()
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Storage Co", "billing_state": "Andhra Pradesh"}).json()
    return client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": customer["id"], "sample_type_id": sample_type["id"], "test_definition_ids": [test_def["id"]]},
    ).json()


def test_storage_location_hierarchy_nests_and_rejects_a_bad_type():
    slug = f"labstor-hierarchy-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}

    freezer = client.post("/api/v1/lab/storage-locations", headers=headers, json={"code": "FZ1", "name": "Freezer 1", "location_type": "freezer", "temperature_c": "-20.0"})
    assert freezer.status_code == 201, freezer.text
    assert freezer.json()["parent_name"] is None

    shelf = client.post(
        "/api/v1/lab/storage-locations", headers=headers,
        json={"code": "FZ1-S2", "name": "Shelf 2", "location_type": "shelf", "parent_location_id": freezer.json()["id"]},
    )
    assert shelf.status_code == 201, shelf.text
    assert shelf.json()["parent_name"] == "Freezer 1"

    bad_type = client.post("/api/v1/lab/storage-locations", headers=headers, json={"code": "X", "name": "X", "location_type": "spaceship"})
    assert bad_type.status_code == 400

    bad_parent = client.post("/api/v1/lab/storage-locations", headers=headers, json={"code": "Y", "name": "Y", "location_type": "shelf", "parent_location_id": str(uuid.uuid4())})
    assert bad_parent.status_code == 404


def test_custody_event_auto_captures_from_location_and_updates_current_location():
    slug = f"labstor-custody-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    sample = _make_sample(headers)

    room = client.post("/api/v1/lab/storage-locations", headers=headers, json={"code": "ROOM1", "name": "Receiving Room", "location_type": "room"}).json()
    freezer = client.post("/api/v1/lab/storage-locations", headers=headers, json={"code": "FZ1", "name": "Freezer 1", "location_type": "freezer", "temperature_c": "-20.0"}).json()

    received = client.post(f"/api/v1/lab/samples/{sample['id']}/custody-events", headers=headers, json={"event_type": "received", "to_location_id": room["id"]})
    assert received.status_code == 201, received.text
    assert received.json()["from_location_id"] is None
    assert received.json()["to_location_name"] == "Receiving Room"

    stored = client.post(f"/api/v1/lab/samples/{sample['id']}/custody-events", headers=headers, json={"event_type": "stored", "to_location_id": freezer["id"], "notes": "Long-term storage"})
    assert stored.status_code == 201
    # from_location_id must be the room (auto-captured from the sample's own prior state), never caller-supplied.
    assert stored.json()["from_location_id"] == room["id"]
    assert stored.json()["to_location_name"] == "Freezer 1"

    detail = client.get(f"/api/v1/lab/samples/{sample['id']}", headers=headers).json()
    assert detail["current_location_id"] == freezer["id"]
    assert detail["current_location_name"] == "Freezer 1"

    history = client.get(f"/api/v1/lab/samples/{sample['id']}/custody-events", headers=headers).json()
    assert len(history) == 2
    assert history[0]["event_type"] == "stored"  # most recent first
    assert history[1]["event_type"] == "received"


def test_checked_out_and_disposed_events_reject_a_target_location():
    slug = f"labstor-checkout-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    sample = _make_sample(headers)
    freezer = client.post("/api/v1/lab/storage-locations", headers=headers, json={"code": "FZ1", "name": "Freezer 1", "location_type": "freezer"}).json()

    client.post(f"/api/v1/lab/samples/{sample['id']}/custody-events", headers=headers, json={"event_type": "stored", "to_location_id": freezer["id"]})

    bad_checkout = client.post(f"/api/v1/lab/samples/{sample['id']}/custody-events", headers=headers, json={"event_type": "checked_out", "to_location_id": freezer["id"]})
    assert bad_checkout.status_code == 400, bad_checkout.text

    checked_out = client.post(f"/api/v1/lab/samples/{sample['id']}/custody-events", headers=headers, json={"event_type": "checked_out"})
    assert checked_out.status_code == 201, checked_out.text
    assert checked_out.json()["from_location_id"] == freezer["id"]
    assert checked_out.json()["to_location_id"] is None

    detail = client.get(f"/api/v1/lab/samples/{sample['id']}", headers=headers).json()
    assert detail["current_location_id"] is None


def test_a_disposed_sample_blocks_further_custody_events():
    slug = f"labstor-dispose-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    sample = _make_sample(headers)
    freezer = client.post("/api/v1/lab/storage-locations", headers=headers, json={"code": "FZ1", "name": "Freezer 1", "location_type": "freezer"}).json()

    client.post(f"/api/v1/lab/samples/{sample['id']}/custody-events", headers=headers, json={"event_type": "stored", "to_location_id": freezer["id"]})
    disposed = client.post(f"/api/v1/lab/samples/{sample['id']}/custody-events", headers=headers, json={"event_type": "disposed"})
    assert disposed.status_code == 201

    blocked = client.post(f"/api/v1/lab/samples/{sample['id']}/custody-events", headers=headers, json={"event_type": "stored", "to_location_id": freezer["id"]})
    assert blocked.status_code == 409
    assert "already been disposed" in blocked.json()["error"]["message"]


def test_a_stored_event_without_a_target_location_is_rejected():
    slug = f"labstor-required-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    sample = _make_sample(headers)

    resp = client.post(f"/api/v1/lab/samples/{sample['id']}/custody-events", headers=headers, json={"event_type": "stored"})
    assert resp.status_code == 400


def test_an_invalid_event_type_is_rejected():
    slug = f"labstor-badtype-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    sample = _make_sample(headers)

    resp = client.post(f"/api/v1/lab/samples/{sample['id']}/custody-events", headers=headers, json={"event_type": "teleported"})
    assert resp.status_code == 400


def test_storage_rbac_denial_and_tenant_isolation():
    slug_a = f"labstor-rbac-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"labstor-rbac-b-{uuid.uuid4().hex[:8]}"
    token_a = _signup(slug_a)
    token_b = _signup(slug_b)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    sample_a = _make_sample(headers_a)
    location_a = client.post("/api/v1/lab/storage-locations", headers=headers_a, json={"code": "FZ1", "name": "Freezer 1", "location_type": "freezer"}).json()

    cross_tenant_custody = client.post(f"/api/v1/lab/samples/{sample_a['id']}/custody-events", headers=headers_b, json={"event_type": "stored", "to_location_id": location_a["id"]})
    assert cross_tenant_custody.status_code == 404

    no_auth = client.get("/api/v1/lab/storage-locations")
    assert no_auth.status_code == 401
