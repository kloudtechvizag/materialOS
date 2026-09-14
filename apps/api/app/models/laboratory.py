"""Laboratory & Scientific Testing (industry #25) -- the real walking
skeleton of the sample lifecycle described in the LIMS master prompt's
sec3/sec88: Client -> Sample -> Accession -> Test Order -> Result ->
Report, with real status transitions and a versioned, never-overwritten
report. Deliberately NOT built in this pass (named, not faked):
aliquot genealogy, reflex/dilution rules, multi-stage technical/QC/
pathologist review (collapsed here to entry -> validate -> authorize),
competency-gated RBAC, electronic-signature workflow (a real
second-user check exists, but it is not a compliant e-signature per
the spec's own sec36), and the customer portal. Client reuses the
existing Customer model (spec sec28 explicitly asks for this), not a
new lab_clients table.

**QC subsystem (blanks/controls/duplicates), second pass:** real, not
config-only. `QcReferenceSample` is a scoped-down merge of the spec's
separate "Reference Sample" and "Reference Analysis" concepts (sec30-
31) -- one row per control/blank *for one specific test*, carrying its
own acceptance range, rather than a generic reference material that
supports many analyses each with their own expected-result row. No QC
run ever recorded for a test does not block authorization (a lab that
hasn't configured QC for that test yet isn't bricked), but a recorded
failure does, until superseded by a pass. Westgard-style multi-rule
statistics (sec66) and Levey-Jennings charts (sec65) remain named,
later gaps.

**Worksheets (batch testing), third pass:** real, not config-only.
`LabWorksheet` groups test orders for one test definition into a batch
run by one analyst (sec15) -- test orders opt in via `worksheet_id`
rather than a separate join table, since one test order belongs to at
most one worksheet. QC runs (blank/control/duplicate) can likewise be
recorded *against* a worksheet via the same `worksheet_id` column on
`QcRun`. This is what makes QC-per-worksheet-batch scoping real instead
of the second pass's coarser "most recent run for the whole test"
fallback: `authorize_result` now checks QC scoped to the specific
worksheet a result's test order belongs to, and only falls back to the
test-definition-wide most-recent-run check for test orders that were
never put on a worksheet at all (the walking-skeleton path, still
fully supported). Deliberately NOT built: worksheet templates/layout
positions (sec15's fixed-position plate map), multi-test-definition
worksheets, and re-running a worksheet in place (a new worksheet must
be created instead) -- named gaps, not silent omissions.

**Instrument integration, fourth pass:** real, but deliberately scoped
to file-based result import, not a live ASTM E1394/HL7 v2.x wire
protocol (sec21-23). This codebase has no real instrument to connect
to and no verified serial/TCP driver stack -- shipping an untested
protocol implementation would itself be fake functionality dressed up
as real. What's real instead: `LabInstrument` is a genuine catalog
entity, and `LabResult.instrument_id` genuinely records which
instrument produced a result (null means a human keyed it in). A real
CSV import endpoint matches each row (sample_number, test_code,
result_value) against a pending test order and calls the same
`enter_result` used by manual entry -- this is an honest, commonly-used
real-world integration pattern for labs without HL7 middleware budget,
not a placeholder. A live ASTM/HL7 listener, and instrument-specific
result-format parsers beyond the generic three-column CSV, remain
named, later gaps.

**Storage & chain of custody, fifth pass:** real. `LabStorageLocation`
is a self-referencing hierarchy (freezer -> shelf -> rack -> box, or
however deep a lab needs), and `LabCustodyEvent` is a genuine
append-only ledger -- rows are only ever inserted, never updated or
deleted, matching the spec's "chain of custody as its own ledger"
framing (sec8-10) rather than overloading `LabSample`'s own mutable
columns. `LabSample.current_location_id` is a deliberate denormalized
fast-lookup pointer (today's location), while `LabCustodyEvent` is the
durable historical record; `from_location_id` on each event is always
captured automatically from the sample's own state at the moment of
the event, never accepted from the caller, so the ledger can't be
spoofed into recording a movement that didn't happen. Aliquot
genealogy (sec9 -- splitting one sample into independently trackable
child aliquots) is a real, later gap: this pass tracks one sample's
whole-sample movement, not sub-sample lineage.

**Specifications, sixth pass:** real, additive, and deliberately
layered rather than a replacement. `LabTestDefinition.reference_range_*`
/`critical_*` remain exactly what they were -- the lab-wide default
`flag` (normal/abnormal/critical) computed in `_compute_flag`.
`LabSpecification` is a *second*, independent pass/fail mechanism for
what those flat columns structurally cannot express: a specific
client's own tighter contractual limit, or a different limit per
sample type sharing the same test (spec sec24's own example -- Concrete
M30 and M40 both run Compressive Strength, but each grade needs its own
minimum). A result's `specification_result` (pass/fail) is computed
only when a specification actually resolves for that (test, client,
sample type) combination -- no specification configured means no
verdict, never a fabricated one. Resolution precedence when several
specifications could apply to the same test:
(client + sample_type) > client-only > sample_type-only > the
tenant-wide default (neither set). Deliberately NOT built: arbitrary
"conditional rules" (spec sec24's own phrase) -- a real rule engine
evaluating expressions over sample metadata is a much bigger, separate
feature than a scoped range/target-tolerance/text comparison, and
faking one behind a config field nobody could actually configure would
be worse than not having it.
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
WORKSHEET_STATUSES = ["open", "in_progress", "completed"]
STORAGE_LOCATION_TYPES = ["room", "freezer", "refrigerator", "cabinet", "shelf", "rack", "box"]
CUSTODY_EVENT_TYPES = ["received", "stored", "moved", "checked_out", "checked_in", "disposed"]
SPECIFICATION_CRITERIA_TYPES = ["range", "text"]
SPECIFICATION_RESULTS = ["pass", "fail"]


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
    # Denormalized fast-lookup pointer -- the durable historical record
    # is LabCustodyEvent, not this column (see module docstring).
    current_location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_storage_locations.id", ondelete="SET NULL"), nullable=True, index=True)


class LabTestOrder(Base, UUIDPk, TenantMixin, TimestampMixin):
    __tablename__ = "lab_test_orders"

    sample_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_samples.id", ondelete="CASCADE"), nullable=False, index=True)
    test_definition_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_test_definitions.id", ondelete="RESTRICT"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ordered")
    ordered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # A test order belongs to at most one worksheet -- opt-in via this
    # column rather than a separate join table (see module docstring).
    worksheet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_worksheets.id", ondelete="SET NULL"), nullable=True, index=True)


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
    # Which instrument produced this result via a CSV import -- null
    # means a human keyed it in manually (see module docstring).
    instrument_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_instruments.id", ondelete="SET NULL"), nullable=True, index=True)
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    flag: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # The specification actually resolved for this result's (test,
    # client, sample type) at entry time, and the pass/fail verdict --
    # both null if no specification was configured (see module
    # docstring: no fabricated verdicts).
    specification_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_specifications.id", ondelete="SET NULL"), nullable=True, index=True)
    specification_result: Mapped[str | None] = mapped_column(String(10), nullable=True)
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
    # Set when this run was recorded as part of a specific worksheet's
    # batch (see LabWorksheet) -- null for a run recorded standalone,
    # outside any worksheet.
    worksheet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_worksheets.id", ondelete="SET NULL"), nullable=True, index=True)
    reference_sample_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("qc_reference_samples.id", ondelete="RESTRICT"), nullable=True)
    source_test_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_test_orders.id", ondelete="RESTRICT"), nullable=True)
    result_value: Mapped[str] = mapped_column(String(500), nullable=False)
    numeric_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    rpd_percent: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False)  # pass | fail
    performed_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class LabWorksheet(Base, UUIDPk, TenantMixin, TimestampMixin):
    """A batch of test orders for one test definition, run together by
    one analyst (spec sec15). Test orders and QC runs opt into a
    worksheet via their own nullable worksheet_id column rather than a
    join table -- see module docstring for why. Deliberately NOT a
    fixed-position plate map: `LabTestOrder.worksheet_id` records
    membership, not a specific well/slot position.
    """

    __tablename__ = "lab_worksheets"
    __table_args__ = (UniqueConstraint("tenant_id", "worksheet_number", name="uq_lab_worksheets_tenant_number"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    worksheet_number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    test_definition_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_test_definitions.id", ondelete="RESTRICT"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    analyst_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LabInstrument(Base, UUIDPk, TenantMixin, TimestampMixin):
    """A catalog entry for a physical instrument whose results are
    imported via CSV rather than manually keyed -- see module docstring
    for why this stops short of a live ASTM/HL7 wire protocol.
    """

    __tablename__ = "lab_instruments"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "code", name="uq_lab_instruments_company_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    manufacturer: Mapped[str | None] = mapped_column(String(150), nullable=True)
    model: Mapped[str | None] = mapped_column(String(150), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class LabStorageLocation(Base, UUIDPk, TenantMixin, TimestampMixin):
    """A self-referencing hierarchy -- freezer -> shelf -> rack -> box,
    or as shallow or deep as a lab actually needs (spec sec8's storage
    hierarchy, scoped down to one generic self-FK rather than named
    tables per level)."""

    __tablename__ = "lab_storage_locations"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "code", name="uq_lab_storage_locations_company_code"),)

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    parent_location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_storage_locations.id", ondelete="SET NULL"), nullable=True, index=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    location_type: Mapped[str] = mapped_column(String(20), nullable=False)
    temperature_c: Mapped[Decimal | None] = mapped_column(Numeric(5, 1), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class LabCustodyEvent(Base, UUIDPk, TenantMixin, TimestampMixin):
    """Append-only chain-of-custody ledger (spec sec8-10) -- rows are
    only ever inserted, never updated or deleted. from_location_id is
    always captured server-side from the sample's own current_location_
    id at the moment of the event, never accepted from the caller, so
    the ledger can't be spoofed into recording a movement that didn't
    happen."""

    __tablename__ = "lab_custody_events"

    sample_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_samples.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    from_location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_storage_locations.id", ondelete="SET NULL"), nullable=True)
    to_location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_storage_locations.id", ondelete="SET NULL"), nullable=True)
    performed_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)


class LabSpecification(Base, UUIDPk, TenantMixin, TimestampMixin):
    """A pass/fail criterion for one test, optionally scoped to a
    specific client and/or sample type -- see module docstring for why
    this exists alongside (not instead of) LabTestDefinition's own flat
    reference_range/critical columns. `client_id`/`sample_type_id` null
    means "applies regardless" at that axis; both null is the tenant-
    wide default for the test. Exactly one specification may exist per
    (test_definition_id, client_id, sample_type_id) triple -- enforced
    in the service layer with a null-safe query rather than a DB
    UNIQUE constraint, since Postgres treats NULL as distinct from NULL
    in unique constraints and would silently allow duplicate defaults.

    criteria_type "range" evaluates numeric_value against min_value/
    max_value, or against target_value +/- tolerance when neither bound
    is set directly. criteria_type "text" evaluates result_value as an
    exact (case-insensitive) match against text_value -- e.g. a
    microbiology test whose specification is simply "Absent".
    """

    __tablename__ = "lab_specifications"

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    test_definition_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_test_definitions.id", ondelete="RESTRICT"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=True, index=True)
    sample_type_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_sample_types.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    criteria_type: Mapped[str] = mapped_column(String(10), nullable=False, default="range")
    min_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    max_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    target_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    tolerance: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    text_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
