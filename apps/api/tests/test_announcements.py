"""Communication Center (spec sec20): staff-authored announcements
targeted at the whole school, a class, or a section, visible in the
Guardian Portal (ADR-032) only to guardians whose children are
actually in scope -- exercised through the real HTTP API.
"""
import uuid
from datetime import date, timedelta

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


def _login(slug: str, email: str, password: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": slug, "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _setup_two_classes_with_guardians():
    slug = f"ann-{uuid.uuid4().hex[:8]}"
    staff_token = _signed_up_token(slug)
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    year = client.post(
        "/api/v1/academic-years", headers=staff_headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()

    def _make_family(class_name, first_name):
        school_class = client.post("/api/v1/school-classes", headers=staff_headers, json={"academic_year_id": year["id"], "name": class_name, "sequence": 1}).json()
        section = client.post("/api/v1/sections", headers=staff_headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
        student = client.post(
            "/api/v1/students", headers=staff_headers,
            json={
                "first_name": first_name, "last_name": "Test", "admission_date": "2026-06-01",
                "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "1",
            },
        ).json()
        guardian = client.post("/api/v1/guardians", headers=staff_headers, json={"full_name": f"Parent of {first_name}"}).json()
        client.post(f"/api/v1/students/{student['id']}/guardians", headers=staff_headers, json={"guardian_id": guardian["id"], "relationship_type": "father", "is_primary_contact": True})
        portal = client.post(
            f"/api/v1/guardians/{guardian['id']}/portal-access", headers=staff_headers,
            json={"email": f"{first_name.lower()}-{slug}@example.com", "password": "guardian-pass-123", "full_name": f"Parent of {first_name}"},
        ).json()
        return school_class, section, student, guardian, portal

    class_a, section_a, student_a, _guardian_a, _portal_a = _make_family("Grade 1", "AliceChild")
    class_b, section_b, student_b, _guardian_b, _portal_b = _make_family("Grade 2", "BobChild")

    return slug, staff_headers, class_a, section_a, student_a, class_b, section_b, student_b


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-ann-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/announcements", headers=headers)
    assert resp.status_code == 403, resp.text


def test_class_announcement_requires_a_class_and_no_section():
    slug = f"ann-bad-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post("/api/v1/announcements", headers=headers, json={"title": "X", "body": "Y", "target_type": "class"})
    assert resp.status_code == 400, resp.text


def test_school_wide_announcement_is_visible_to_every_guardian():
    slug, staff_headers, _class_a, _section_a, _student_a, _class_b, _section_b, _student_b = _setup_two_classes_with_guardians()

    client.post("/api/v1/announcements", headers=staff_headers, json={"title": "PTM this Friday", "body": "All classes", "target_type": "school"})

    alice_token = _login(slug, f"alicechild-{slug}@example.com", "guardian-pass-123")
    bob_token = _login(slug, f"bobchild-{slug}@example.com", "guardian-pass-123")

    for token in (alice_token, bob_token):
        anns = client.get("/api/v1/guardian-portal/announcements", headers={"Authorization": f"Bearer {token}"}).json()
        assert len(anns) == 1
        assert anns[0]["title"] == "PTM this Friday"
        assert anns[0]["is_read"] is False


def test_class_announcement_is_visible_only_to_that_classs_guardians():
    slug, staff_headers, class_a, section_a, student_a, class_b, section_b, student_b = _setup_two_classes_with_guardians()

    client.post(
        "/api/v1/announcements", headers=staff_headers,
        json={"title": "Grade 1 field trip", "body": "Bring a hat", "target_type": "class", "target_school_class_id": class_a["id"]},
    )

    alice_token = _login(slug, f"alicechild-{slug}@example.com", "guardian-pass-123")
    bob_token = _login(slug, f"bobchild-{slug}@example.com", "guardian-pass-123")

    alice_anns = client.get("/api/v1/guardian-portal/announcements", headers={"Authorization": f"Bearer {alice_token}"}).json()
    bob_anns = client.get("/api/v1/guardian-portal/announcements", headers={"Authorization": f"Bearer {bob_token}"}).json()

    assert len(alice_anns) == 1
    assert alice_anns[0]["title"] == "Grade 1 field trip"
    assert bob_anns == []


def test_marking_read_persists_and_expired_announcements_are_hidden():
    slug, staff_headers, _class_a, _section_a, _student_a, _class_b, _section_b, _student_b = _setup_two_classes_with_guardians()

    live = client.post("/api/v1/announcements", headers=staff_headers, json={"title": "Live notice", "body": "B", "target_type": "school"}).json()
    client.post(
        "/api/v1/announcements", headers=staff_headers,
        json={"title": "Expired notice", "body": "B", "target_type": "school", "expires_at": str(date.today() - timedelta(days=1))},
    )

    token = _login(slug, f"alicechild-{slug}@example.com", "guardian-pass-123")
    headers = {"Authorization": f"Bearer {token}"}

    anns = client.get("/api/v1/guardian-portal/announcements", headers=headers).json()
    assert len(anns) == 1
    assert anns[0]["title"] == "Live notice"

    mark = client.post(f"/api/v1/guardian-portal/announcements/{live['id']}/read", headers=headers)
    assert mark.status_code == 204, mark.text

    anns_after = client.get("/api/v1/guardian-portal/announcements", headers=headers).json()
    assert anns_after[0]["is_read"] is True


def test_staff_can_delete_an_announcement():
    slug, staff_headers, _class_a, _section_a, _student_a, _class_b, _section_b, _student_b = _setup_two_classes_with_guardians()

    ann = client.post("/api/v1/announcements", headers=staff_headers, json={"title": "Oops", "body": "B", "target_type": "school"}).json()
    resp = client.delete(f"/api/v1/announcements/{ann['id']}", headers=staff_headers)
    assert resp.status_code == 204, resp.text

    remaining = client.get("/api/v1/announcements", headers=staff_headers).json()
    assert remaining == []
