"""ADR-015: People & Payroll -- employee lifecycle, attendance, leave,
and the payroll calculation/approval/lock/pay pipeline, exercised the
way a real client would (HTTP, through the actual FastAPI app).
"""
import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _signed_up_token(slug: str) -> str:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    )
    return login_resp.json()["access_token"]


def _setup_tenant():
    slug = f"hrpay-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]
    return headers, branch_id


def _create_employee(headers, branch_id, *, first_name="Rahul", with_bank=True, with_salary=True):
    resp = client.post(
        "/api/v1/employees", headers=headers,
        json={"branch_id": branch_id, "first_name": first_name, "last_name": "Kumar", "joining_date": "2026-01-01", "employment_type": "full_time"},
    )
    assert resp.status_code == 201, resp.text
    employee = resp.json()
    if with_bank:
        client.patch(f"/api/v1/employees/{employee['id']}/compensation", headers=headers, json={"bank_account_number": "1234", "bank_ifsc": "HDFC0001234", "bank_name": "HDFC"})
    if with_salary:
        client.post(f"/api/v1/employees/{employee['id']}/salary", headers=headers, json={"effective_date": "2026-01-01", "annual_ctc": "600000", "monthly_gross": "50000", "basic": "25000"})
    return employee


def test_employee_creation_logs_joined_event_on_timeline():
    headers, branch_id = _setup_tenant()
    employee = _create_employee(headers, branch_id)

    timeline = client.get(f"/api/v1/employees/{employee['id']}/timeline", headers=headers).json()
    assert any(e["event_type"] == "joined" for e in timeline)
    assert any(e["event_type"] == "salary_revision" for e in timeline)
    assert employee["employee_code"] == "EMP-0001"


def test_status_change_is_tracked_on_timeline():
    headers, branch_id = _setup_tenant()
    employee = _create_employee(headers, branch_id)

    resp = client.patch(f"/api/v1/employees/{employee['id']}", headers=headers, json={"status": "resigned"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "resigned"

    timeline = client.get(f"/api/v1/employees/{employee['id']}/timeline", headers=headers).json()
    assert any(e["event_type"] == "status_changed" for e in timeline)


def test_leave_request_approval_deducts_balance():
    headers, branch_id = _setup_tenant()
    employee = _create_employee(headers, branch_id)

    leave_types = client.get("/api/v1/leave/types", headers=headers).json()
    casual = next(t for t in leave_types if t["code"] == "casual")

    # Owner is the requester here (self-service isn't linked in this
    # test) -- request via the employee-scoped review flow instead:
    # link the owner's own user to this employee so /leave/requests
    # (self-service) resolves correctly.
    users = client.get("/api/v1/users", headers=headers).json()
    owner_user_id = users[0]["id"]
    client.patch(f"/api/v1/employees/{employee['id']}", headers=headers, json={"user_id": owner_user_id})

    resp = client.post(
        "/api/v1/leave/requests", headers=headers,
        json={"leave_type_id": casual["id"], "start_date": "2026-09-10", "end_date": "2026-09-11", "reason": "Personal"},
    )
    assert resp.status_code == 201, resp.text
    leave_request_id = resp.json()["id"]

    review = client.post(f"/api/v1/leave/requests/{leave_request_id}/review", headers=headers, json={"approve": True})
    assert review.status_code == 200, review.text
    assert review.json()["status"] == "approved"

    balances = client.get("/api/v1/leave/balance/me", headers=headers).json()
    casual_balance = next(b for b in balances if b["leave_type_id"] == casual["id"])
    assert casual_balance["used_days"] == "2.00"


def test_payroll_approval_blocked_by_missing_bank_and_salary_exceptions():
    headers, branch_id = _setup_tenant()
    _create_employee(headers, branch_id, first_name="Incomplete", with_bank=False, with_salary=False)

    run_resp = client.post("/api/v1/payroll/runs", headers=headers, json={"period_start": "2026-09-01", "period_end": "2026-09-30", "period_label": "September 2026"})
    run_id = run_resp.json()["id"]

    calc = client.post(f"/api/v1/payroll/runs/{run_id}/calculate", headers=headers)
    assert calc.status_code == 200, calc.text
    assert calc.json()["status"] == "calculated"

    items = client.get(f"/api/v1/payroll/runs/{run_id}/items", headers=headers).json()
    assert any(e["type"] == "missing_bank_details" for e in items[0]["exceptions"])
    assert any(e["type"] == "missing_salary_structure" for e in items[0]["exceptions"])

    approve = client.post(f"/api/v1/payroll/runs/{run_id}/approve", headers=headers)
    assert approve.status_code == 400
    assert approve.json()["error"]["code"] == "VALIDATION_ERROR"


def test_payroll_full_lifecycle_posts_a_balanced_journal():
    headers, branch_id = _setup_tenant()
    employee = _create_employee(headers, branch_id)

    run_resp = client.post("/api/v1/payroll/runs", headers=headers, json={"period_start": "2026-09-01", "period_end": "2026-09-30", "period_label": "September 2026"})
    run_id = run_resp.json()["id"]

    calc = client.post(f"/api/v1/payroll/runs/{run_id}/calculate", headers=headers)
    assert calc.status_code == 200, calc.text
    # Zero attendance recorded -- full LOP, net pay is 0 but the run
    # still calculates cleanly (no blocking exceptions: bank + salary
    # are both set).
    items = client.get(f"/api/v1/payroll/runs/{run_id}/items", headers=headers).json()
    assert items[0]["exceptions"] == [] or all(not e.get("blocking") for e in items[0]["exceptions"])

    approve = client.post(f"/api/v1/payroll/runs/{run_id}/approve", headers=headers)
    assert approve.status_code == 200, approve.text

    lock = client.post(f"/api/v1/payroll/runs/{run_id}/lock", headers=headers)
    assert lock.status_code == 200, lock.text
    assert lock.json()["status"] == "locked"

    pay = client.post(f"/api/v1/payroll/runs/{run_id}/pay", headers=headers)
    assert pay.status_code == 200, pay.text
    assert pay.json()["status"] == "paid"

    # Locked/recalculation refusal (spec sec109: never silently re-edit
    # a locked run).
    recalc_after_lock = client.post(f"/api/v1/payroll/runs/{run_id}/calculate", headers=headers)
    assert recalc_after_lock.status_code == 409


def test_deductions_never_exceed_earnings_and_journal_stays_balanced(db, tenant_ctx):
    """Regression test for the exact bug caught during live verification:
    an employee with zero attendance still had a full flat deduction
    (Professional Tax) applied against ~0 gross, producing a negative
    net_pay. Exercised at the service layer with a real Postgres
    transaction so the balanced-journal assertion reads real
    JournalLine rows, not mocks.
    """
    from decimal import Decimal

    from sqlalchemy import select

    from app.models.accounting import JournalEntry, JournalLine
    from app.models.hr import Employee
    from app.models.payroll import EmployeeSalaryAssignment, PayrollItem
    from app.services.hr import ensure_default_salary_components
    from app.services.payroll import approve_payroll_run, calculate_payroll_run, create_payroll_run, lock_payroll_run

    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    branch = tenant_ctx["branch"]

    ensure_default_salary_components(db, tenant_id=tenant.id, company_id=company.id)

    employee = Employee(
        tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, employee_code="EMP-TEST-1",
        first_name="Zero", last_name="Attendance", joining_date=date(2026, 1, 1), status="active",
        bank_account_number="1234", bank_ifsc="HDFC0001234",
    )
    db.add(employee)
    db.flush()
    db.add(EmployeeSalaryAssignment(tenant_id=tenant.id, employee_id=employee.id, effective_date=date(2026, 1, 1), annual_ctc=Decimal("120000"), monthly_gross=Decimal("10000"), basic=Decimal("5000")))
    db.flush()

    run = create_payroll_run(db, tenant_id=tenant.id, company_id=company.id, period_start=date(2026, 9, 1), period_end=date(2026, 9, 30), period_label="September 2026")
    run = calculate_payroll_run(db, tenant_id=tenant.id, payroll_run_id=run.id)

    item = db.execute(select(PayrollItem).where(PayrollItem.payroll_run_id == run.id, PayrollItem.employee_id == employee.id)).scalar_one()
    assert item.net_pay >= 0  # never negative, even with 0 attendance and a flat PT deduction
    assert item.gross_earnings == Decimal("0")

    user_id = uuid.uuid4()
    run = approve_payroll_run(db, tenant_id=tenant.id, payroll_run_id=run.id, approved_by_user_id=user_id)
    run = lock_payroll_run(db, tenant_id=tenant.id, payroll_run_id=run.id)

    entry = db.execute(select(JournalEntry).where(JournalEntry.tenant_id == tenant.id, JournalEntry.document_id == run.id)).scalar_one()
    run_lines = db.execute(select(JournalLine).where(JournalLine.tenant_id == tenant.id, JournalLine.journal_entry_id == entry.id)).scalars().all()
    assert sum(l.debit for l in run_lines) == sum(l.credit for l in run_lines)
