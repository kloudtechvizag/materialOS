"""Laboratory & Scientific Testing (industry #25) -- the real walking
skeleton of the sample lifecycle described in the LIMS master prompt's
sec3/sec88: Client -> Sample -> Accession -> Test Order -> Result ->
Report, with real status transitions and a versioned, never-overwritten
report. Deliberately NOT built in this pass (named, not faked):
worksheets/batch testing, instrument integration, chain of custody as
its own ledger, storage hierarchy, aliquot genealogy, reflex/dilution
rules, multi-stage technical/QC/pathologist review (collapsed here to
entry -> validate -> authorize), competency-gated RBAC, electronic-
signature workflow (a real second-user check exists, but it is not a
compliant e-signature per the spec's own sec36), and the customer
portal. Client reuses the existing Customer model (spec sec28
explicitly asks for this), not a new lab_clients table.

**QC subsystem (blanks/controls/duplicates), second pass:** real, not
config-only. `QcReferenceSample` is a scoped-down merge of the spec's
separate "Reference Sample" and "Reference Analysis" concepts (sec30-
31) -- one row per control/blank *for one specific test*, carrying its
own acceptance range, rather than a generic reference material that
supports many analyses each with their own expected-result row. A real
lab QC failure is meant to be scoped to one worksheet's batch of
samples (sec67); since worksheets don't exist yet, the honest, buildable
substitute here is coarser but real: `authorize_result` checks the
*most recent* QcRun for that result's test definition, of any type --
if it's a fail, authorization is blocked until a fresh QC run for that
test passes. No QC run ever recorded for a test does not block (a lab
that hasn't configured QC for that test yet isn't bricked), but a
recorded failure does, until superseded by a pass. Westgard-style
multi-rule statistics (sec66), Levey-Jennings charts (sec65), and
QC-per-worksheet scoping are named, later gaps.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPk

MONEY = Numeric(18, 4)

SAMPLE_STATUSES = ["registered", "accessioned", "accepted", "rejected", "in_process", "completed", "reported", "cancelled"]
SAMPLE_PRIORITIES = ["routine", "urgent", "stat"]
TEST_ORDER_STATUSES = ["ordered", "in_progress", "completed", "cancelled"]
RESULT_TYPES = ["quantitative", "qualitative", "text"]
RESULT_STATUSES = ["draft", "validated", "authorized"]
RESULT_FLAGS = ["normal", "abnormal", "critical"]
REPORT_STATUSES = ["released", "superseded"]
QC_TYPES = ["blank", "control", "duplicate"]
QC_STATUSES = ["pass", "fail"]


class LabSampleType(Base, UUIDPk, TenantMixin, TimestampMixin):
    """A catalog entry, not a generic Category -- sample types carry
    laboratory-specific meaning (default container, stability) that
    would be a misuse of the general item Category table."""

    __tablename__ = "lab_sample_types"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "code", name="uq_lab_sample_types_company_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class LabContainer(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "lab_containers"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "code", name="uq_lab_containers_company_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class LabTestDefinition(Base, UUIDPk, TenantMixin, TimestampMixin):
    """spec sec11, scoped down: one method/unit/reference-range per
    test (no method versioning, no reflex/dilution rules, no instrument
    mapping -- all named as deferred in this module's own docstring).
    A single flat numeric reference range covers the quantitative case;
    qualitative/text tests leave the range columns null and are never
    auto-flagged.
    """

    __tablename__ = "lab_test_definitions"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "code", name="uq_lab_test_definitions_company_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sample_type_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_sample_types.id", ondelete="SET NULL"), nullable=True, index=True)
    method: Mapped[str | None] = mapped_column(String(200), nullable=True)
    result_type: Mapped[str] = mapped_column(String(20), nullable=False, default="quantitative")
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    reference_range_low: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    reference_range_high: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    critical_low: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    critical_high: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    turnaround_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    standard_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    # spec sec27's RPD acceptance criteria -- null means duplicate QC
    # isn't configured for this test (duplicates can still be recorded,
    # just never auto-flagged pass/fail without a threshold to compare against).
    duplicate_rpd_limit_percent: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class LabSample(Base, UUIDPk, TenantMixin, TimestampMixin):
    """sample_number doubles as the accession number and the barcode
    payload (spec sec6/sec7 name these as three concepts; this pass
    deliberately keeps one canonical identifier rather than three
    unsynchronized ones -- separate barcode symbology/multiple-ID
    schemes are a real, later gap, not an oversight).
    """

    __tablename__ = "lab_samples"
    __table_args__ = (UniqueConstraint("tenant_id", "sample_number", name="uq_lab_samples_tenant_number"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False, index=True)
    sample_number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    sample_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_sample_types.id", ondelete="RESTRICT"), nullable=False, index=True)
    container_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_containers.id", ondelete="SET NULL"), nullable=True)
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="routine")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="registered")
    collection_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class LabTestOrder(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "lab_test_orders"

    sample_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_samples.id", ondelete="CASCADE"), nullable=False, index=True)
    test_definition_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_test_definitions.id", ondelete="RESTRICT"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ordered")
    ordered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class LabResult(Base, UUIDPk, TenantMixin, TimestampMixin):
    """One active result per test order in this pass -- reruns/repeat
    testing (spec sec16-17) would need a real result-history table,
    named as deferred rather than silently unsupported.
    """

    __tablename__ = "lab_results"
    __table_args__ = (UniqueConstraint("test_order_id", name="uq_lab_results_test_order"),)

    test_order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_test_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    result_value: Mapped[str] = mapped_column(String(500), nullable=False)
    numeric_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    flag: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    entered_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    validated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    authorized_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    authorized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LabReport(Base, UUIDPk, TenantMixin, TimestampMixin):
    """spec sec35: never overwritten. Superseding creates a new row
    with version+1 and points the old row at it via superseded_by_
    report_id; the old row's own columns are never touched.
    """

    __tablename__ = "lab_reports"
    # report_number is shared across every version of the same report
    # (spec sec35's "Report v1/v2/v3" example) -- the tuple that must be
    # unique is (report_number, version), not report_number alone.
    __table_args__ = (UniqueConstraint("tenant_id", "report_number", "version", name="uq_lab_reports_tenant_number_version"),)

    sample_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_samples.id", ondelete="RESTRICT"), nullable=False, index=True)
    report_number: Mapped[str] = mapped_column(String(40), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="released")
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    released_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    superseded_by_report_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_reports.id", ondelete="SET NULL"), nullable=True)


class QcReferenceSample(Base, UUIDPk, TenantMixin, TimestampMixin):
    """One control/blank material *for one specific test*, with its own
    acceptance range -- a scoped-down merge of the spec's separate
    Reference Sample (sec30) and Reference Analysis (sec31) concepts.
    A "blank" typically expects ~0 (expected_low/high bracket zero); a
    "control" carries whatever range the CRM certificate states.
    """

    __tablename__ = "qc_reference_samples"

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    test_definition_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_test_definitions.id", ondelete="RESTRICT"), nullable=False, index=True)
    qc_type: Mapped[str] = mapped_column(String(20), nullable=False)  # blank | control
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    lot_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_low: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    expected_high: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class QcRun(Base, UUIDPk, TenantMixin, TimestampMixin):
    """A real, recorded QC execution -- blank/control runs compare
    against a QcReferenceSample's expected range; duplicate runs
    compare against the original result's own value via RPD and the
    test definition's duplicate_rpd_limit_percent. Exactly one of
    reference_sample_id / source_test_order_id is set, matching this
    codebase's usual "exactly one of" convention (enforced in the
    service layer, not a DB CHECK constraint).
    """

    __tablename__ = "qc_runs"

    test_definition_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_test_definitions.id", ondelete="RESTRICT"), nullable=False, index=True)
    qc_type: Mapped[str] = mapped_column(String(20), nullable=False)
    reference_sample_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("qc_reference_samples.id", ondelete="RESTRICT"), nullable=True)
    source_test_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_test_orders.id", ondelete="RESTRICT"), nullable=True)
    result_value: Mapped[str] = mapped_column(String(500), nullable=False)
    numeric_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    rpd_percent: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False)  # pass | fail
    performed_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
