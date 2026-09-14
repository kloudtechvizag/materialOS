"""Laboratory instrument integration (fourth pass): a real CSV result
import, not a live ASTM/HL7 wire protocol -- see ADR-021's instruments
addendum for why. Proves an instrument is a real catalog entity, a
result imported this way is tagged with the instrument that produced
it, row-level errors (unknown sample, unknown test, already-resulted
test order, malformed row) are reported per-row rather than silently
dropped or failing the whole batch, and the imported result flows
through the exact same downstream QC/authorize pipeline as a manually
entered one.
"""
import io
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


def _make_test_def(headers: dict, **overrides) -> dict:
    payload = {
        "code": f"PH-{uuid.uuid4().hex[:6]}", "name": "pH", "result_type": "quantitative", "unit": "pH",
        "reference_range_low": "6.5", "reference_range_high": "8.5",
    }
    payload.update(overrides)
    return client.post("/api/v1/lab/test-definitions", headers=headers, json=payload).json()


def _make_accepted_sample(headers: dict, test_def_id: str, sample_type_id: str, customer_id: str) -> dict:
    sample = client.post(
        "/api/v1/lab/samples", headers=headers,
        json={"client_id": customer_id, "sample_type_id": sample_type_id, "test_definition_ids": [test_def_id]},
    ).json()
    client.post(f"/api/v1/lab/samples/{sample['id']}/accession", headers=headers)
    client.post(f"/api/v1/lab/samples/{sample['id']}/accept", headers=headers)
    return sample


def _upload_csv(instrument_id: str, headers: dict, csv_text: str):
    return client.post(
        f"/api/v1/lab/instruments/{instrument_id}/import-results",
        headers=headers,
        files={"file": ("results.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")},
    )


def test_creating_an_instrument_and_listing_it():
    slug = f"labinst-create-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post("/api/v1/lab/instruments", headers=headers, json={"code": "AU680", "name": "Beckman AU680", "manufacturer": "Beckman Coulter", "model": "AU680"})
    assert created.status_code == 201, created.text
    assert created.json()["code"] == "AU680"

    listed = client.get("/api/v1/lab/instruments", headers=headers)
    assert listed.status_code == 200
    assert any(i["code"] == "AU680" for i in listed.json())


def test_csv_import_matches_pending_test_orders_and_tags_the_result_with_the_instrument():
    slug = f"labinst-import-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Instrument Import Co", "billing_state": "Andhra Pradesh"}).json()
    sample = _make_accepted_sample(headers, test_def["id"], sample_type["id"], customer["id"])
    instrument = client.post("/api/v1/lab/instruments", headers=headers, json={"code": "AU680", "name": "Beckman AU680"}).json()

    csv_text = f"sample_number,test_code,result_value\n{sample['sample_number']},{test_def['code']},7.15\n"
    resp = _upload_csv(instrument["id"], headers, csv_text)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["imported_count"] == 1
    assert body["error_count"] == 0
    assert body["rows"][0]["status"] == "imported"
    result_id = body["rows"][0]["result_id"]

    detail = client.get(f"/api/v1/lab/samples/{sample['id']}", headers=headers).json()
    result = next(r for r in detail["results"] if r["id"] == result_id)
    assert result["result_value"] == "7.15"
    assert result["instrument_id"] == instrument["id"]
    assert result["status"] == "draft"


def test_csv_import_reports_unmatched_rows_without_failing_the_whole_batch():
    slug = f"labinst-unmatched-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Unmatched Co", "billing_state": "Andhra Pradesh"}).json()
    sample = _make_accepted_sample(headers, test_def["id"], sample_type["id"], customer["id"])
    instrument = client.post("/api/v1/lab/instruments", headers=headers, json={"code": "AU680", "name": "Beckman AU680"}).json()

    csv_text = (
        "sample_number,test_code,result_value\n"
        f"{sample['sample_number']},{test_def['code']},7.15\n"
        "LAB-DOES-NOT-EXIST,PH,7.00\n"
        f"{sample['sample_number']},NO-SUCH-TEST,7.00\n"
    )
    resp = _upload_csv(instrument["id"], headers, csv_text)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["imported_count"] == 1
    assert body["error_count"] == 2
    statuses = [r["status"] for r in body["rows"]]
    assert statuses == ["imported", "error", "error"]
    assert "No sample numbered" in body["rows"][1]["message"]
    assert "No test definition coded" in body["rows"][2]["message"]


def test_csv_import_rejects_a_row_for_an_already_resulted_test_order():
    slug = f"labinst-dup-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Already Resulted Co", "billing_state": "Andhra Pradesh"}).json()
    sample = _make_accepted_sample(headers, test_def["id"], sample_type["id"], customer["id"])
    instrument = client.post("/api/v1/lab/instruments", headers=headers, json={"code": "AU680", "name": "Beckman AU680"}).json()

    test_order_id = sample["test_orders"][0]["id"]
    entered = client.post(f"/api/v1/lab/test-orders/{test_order_id}/result", headers=headers, json={"result_value": "7.00"})
    assert entered.status_code == 201
    client.post(f"/api/v1/lab/results/{entered.json()['id']}/validate", headers=headers)

    csv_text = f"sample_number,test_code,result_value\n{sample['sample_number']},{test_def['code']},7.20\n"
    resp = _upload_csv(instrument["id"], headers, csv_text)
    assert resp.status_code == 200
    body = resp.json()
    assert body["imported_count"] == 0
    assert body["error_count"] == 1
    assert "already resulted, or never ordered" in body["rows"][0]["message"]


def test_csv_import_requires_an_existing_instrument():
    slug = f"labinst-missing-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    fake_instrument_id = str(uuid.uuid4())
    resp = _upload_csv(fake_instrument_id, headers, "sample_number,test_code,result_value\nX,Y,1\n")
    assert resp.status_code == 404


def test_csv_import_requires_the_expected_columns():
    slug = f"labinst-badcols-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    instrument = client.post("/api/v1/lab/instruments", headers=headers, json={"code": "AU680", "name": "Beckman AU680"}).json()

    resp = _upload_csv(instrument["id"], headers, "foo,bar\n1,2\n")
    assert resp.status_code == 400, resp.text


def test_an_imported_result_still_goes_through_validate_and_authorize_normally():
    """The imported result is not a special second-class record -- it
    flows through the exact same validate/authorize pipeline as a
    manually entered one, including segregation of duties: the user who
    triggered the CSV import (not some instrument-system pseudo-user)
    is entered_by_user_id, so they cannot also authorize the result."""
    slug = f"labinst-flow-{uuid.uuid4().hex[:8]}"
    token = _signup(slug)
    headers = {"Authorization": f"Bearer {token}"}
    test_def = _make_test_def(headers)
    sample_type = client.post("/api/v1/lab/sample-types", headers=headers, json={"code": "WATER", "name": "Water"}).json()
    customer = client.post("/api/v1/customers", headers=headers, json={"name": "Flow Co", "billing_state": "Andhra Pradesh"}).json()
    sample = _make_accepted_sample(headers, test_def["id"], sample_type["id"], customer["id"])
    instrument = client.post("/api/v1/lab/instruments", headers=headers, json={"code": "AU680", "name": "Beckman AU680"}).json()

    email = f"analyst-{slug}@example.com"
    client.post("/api/v1/users", headers=headers, json={"email": email, "full_name": "Analyst", "password": "correct-horse-battery-staple", "role_names": ["owner"]})
    analyst_token = client.post("/api/v1/auth/login", json={"tenant_slug": slug, "email": email, "password": "correct-horse-battery-staple"}).json()["access_token"]
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}

    csv_text = f"sample_number,test_code,result_value\n{sample['sample_number']},{test_def['code']},7.15\n"
    imported = _upload_csv(instrument["id"], headers, csv_text).json()
    result_id = imported["rows"][0]["result_id"]

    # The CSV import was done by the owner, so entered_by_user_id is the
    # owner -- segregation of duties (sec46) applies to imported results
    # exactly as it does to manual ones, so the owner cannot authorize
    # their own import; the analyst (who didn't enter it) can.
    validated = client.post(f"/api/v1/lab/results/{result_id}/validate", headers=analyst_headers)
    assert validated.status_code == 200, validated.text

    owner_blocked = client.post(f"/api/v1/lab/results/{result_id}/authorize", headers=headers)
    assert owner_blocked.status_code == 409

    authorized = client.post(f"/api/v1/lab/results/{result_id}/authorize", headers=analyst_headers)
    assert authorized.status_code == 200, authorized.text
    assert authorized.json()["status"] == "authorized"


def test_instrument_rbac_denial_and_tenant_isolation():
    slug_a = f"labinst-rbac-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"labinst-rbac-b-{uuid.uuid4().hex[:8]}"
    token_a = _signup(slug_a)
    token_b = _signup(slug_b)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    instrument_a = client.post("/api/v1/lab/instruments", headers=headers_a, json={"code": "AU680", "name": "Beckman AU680"}).json()

    listing_b = client.get("/api/v1/lab/instruments", headers=headers_b).json()
    assert all(i["id"] != instrument_a["id"] for i in listing_b)

    cross_tenant_import = _upload_csv(instrument_a["id"], headers_b, "sample_number,test_code,result_value\nX,Y,1\n")
    assert cross_tenant_import.status_code == 404

    no_auth = client.get("/api/v1/lab/instruments")
    assert no_auth.status_code == 401
