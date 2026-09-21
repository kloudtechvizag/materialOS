"""Fee Management (spec sec16/17): fee heads/structure/invoice
generation, exercised through the real HTTP API -- including that fee
invoices are real core Invoices (GST-correct, journal-posted,
collectible via the existing /receipts endpoint), not a parallel
fee-specific ledger.
"""
import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _signed_up_token(slug: str, industry_slug: str = "school_education") -> str:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
            "industry_slug": industry_slug,
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    )
    return login_resp.json()["access_token"]


def _setup_tenant(n_students=2, with_guardian=True):
    slug = f"fee-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]

    year = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "name": "Grade 3", "sequence": 3}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()

    students = []
    for i in range(n_students):
        student = client.post(
            "/api/v1/students", headers=headers,
            json={
                "first_name": f"Student{i}", "last_name": "Test", "admission_date": "2026-06-01",
                "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": str(i + 1),
            },
        ).json()
        if with_guardian:
            guardian = client.post("/api/v1/guardians", headers=headers, json={"full_name": f"Parent of {student['first_name']}", "phone": "9999999999"}).json()
            client.post(f"/api/v1/students/{student['id']}/guardians", headers=headers, json={"guardian_id": guardian["id"], "relationship_type": "father", "is_primary_contact": True})
        students.append(student)

    fee_head = client.post("/api/v1/fee-heads", headers=headers, json={"name": "Tuition Fee", "code": "TUITION"}).json()
    structure_item = client.post(
        "/api/v1/fee-structure-items", headers=headers,
        json={"academic_year_id": year["id"], "school_class_id": school_class["id"], "fee_head_id": fee_head["id"], "amount": "5000", "due_date": "2026-07-15"},
    ).json()

    return headers, branch_id, year, school_class, students, fee_head, structure_item


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-fee-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/fee-heads", headers=headers)
    assert resp.status_code == 403, resp.text


def test_creating_a_fee_head_backs_it_with_a_real_invoiceable_item():
    slug = f"feehead-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post("/api/v1/fee-heads", headers=headers, json={"name": "Transport Fee", "code": "TRANSPORT"})
    assert resp.status_code == 201, resp.text

    items = client.get("/api/v1/items", headers=headers).json()
    assert any(i["sku"] == "FEE-TRANSPORT" for i in items)


def test_generate_invoices_creates_a_real_invoice_and_journal_entry():
    headers, branch_id, _year, school_class, students, _fee_head, structure_item = _setup_tenant(2)

    resp = client.post(
        "/api/v1/fee-invoices/generate", headers=headers,
        json={"school_class_id": school_class["id"], "branch_id": branch_id, "fee_structure_item_ids": [structure_item["id"]]},
    )
    assert resp.status_code == 200, resp.text
    result = resp.json()
    assert len(result["created"]) == 2
    assert result["skipped_student_ids"] == []
    for fee_invoice in result["created"]:
        assert Decimal(fee_invoice["total"]) == Decimal("5000")
        assert Decimal(fee_invoice["outstanding"]) == Decimal("5000")

    invoice_id = result["created"][0]["invoice_id"]
    invoice = client.get(f"/api/v1/invoices/{invoice_id}", headers=headers).json()
    assert Decimal(invoice["subtotal"]) == Decimal("5000")
    assert invoice["status"] == "posted"


def test_regenerating_the_same_fee_does_not_double_bill():
    headers, branch_id, _year, school_class, students, _fee_head, structure_item = _setup_tenant(1)

    first = client.post(
        "/api/v1/fee-invoices/generate", headers=headers,
        json={"school_class_id": school_class["id"], "branch_id": branch_id, "fee_structure_item_ids": [structure_item["id"]]},
    ).json()
    assert len(first["created"]) == 1

    second = client.post(
        "/api/v1/fee-invoices/generate", headers=headers,
        json={"school_class_id": school_class["id"], "branch_id": branch_id, "fee_structure_item_ids": [structure_item["id"]]},
    ).json()
    assert second["created"] == []
    assert second["skipped_student_ids"] == [students[0]["id"]]

    summary = client.get(f"/api/v1/students/{students[0]['id']}/fees", headers=headers).json()
    assert len(summary) == 1


def test_generating_for_a_student_with_no_primary_guardian_is_rejected():
    headers, branch_id, _year, school_class, _students, _fee_head, structure_item = _setup_tenant(1, with_guardian=False)

    resp = client.post(
        "/api/v1/fee-invoices/generate", headers=headers,
        json={"school_class_id": school_class["id"], "branch_id": branch_id, "fee_structure_item_ids": [structure_item["id"]]},
    )
    assert resp.status_code == 400, resp.text


def test_paying_via_the_existing_receipts_endpoint_reduces_fee_outstanding():
    headers, branch_id, _year, school_class, students, _fee_head, structure_item = _setup_tenant(1)

    generated = client.post(
        "/api/v1/fee-invoices/generate", headers=headers,
        json={"school_class_id": school_class["id"], "branch_id": branch_id, "fee_structure_item_ids": [structure_item["id"]]},
    ).json()
    fee_invoice = generated["created"][0]

    invoice = client.get(f"/api/v1/invoices/{fee_invoice['invoice_id']}", headers=headers).json()
    receipt = client.post(
        "/api/v1/receipts", headers=headers,
        json={"customer_id": invoice["customer_id"], "amount": "2000", "mode": "cash", "reference_note": "Part payment", "invoice_id": invoice["id"]},
    )
    assert receipt.status_code == 201, receipt.text

    summary = client.get(f"/api/v1/students/{students[0]['id']}/fees", headers=headers).json()
    assert Decimal(summary[0]["outstanding"]) == Decimal("3000")
