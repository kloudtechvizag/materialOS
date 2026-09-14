import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class LabSampleTypeCreate(BaseModel):
    code: str
    name: str
    description: str | None = None


class LabSampleTypeOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    is_active: bool

    class Config:
        from_attributes = True


class LabContainerCreate(BaseModel):
    code: str
    name: str
    description: str | None = None


class LabContainerOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    is_active: bool

    class Config:
        from_attributes = True


class LabTestDefinitionCreate(BaseModel):
    code: str
    name: str
    category: str | None = None
    sample_type_id: uuid.UUID | None = None
    method: str | None = None
    result_type: str = "quantitative"
    unit: str | None = None
    reference_range_low: Decimal | None = None
    reference_range_high: Decimal | None = None
    critical_low: Decimal | None = None
    critical_high: Decimal | None = None
    turnaround_hours: int | None = None
    standard_price: Decimal = Decimal("0")
    duplicate_rpd_limit_percent: Decimal | None = None


class LabTestDefinitionOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    category: str | None
    sample_type_id: uuid.UUID | None
    method: str | None
    result_type: str
    unit: str | None
    reference_range_low: Decimal | None
    reference_range_high: Decimal | None
    critical_low: Decimal | None
    critical_high: Decimal | None
    turnaround_hours: int | None
    standard_price: Decimal
    duplicate_rpd_limit_percent: Decimal | None
    is_active: bool

    class Config:
        from_attributes = True


class LabSampleCreate(BaseModel):
    client_id: uuid.UUID
    sample_type_id: uuid.UUID
    container_id: uuid.UUID | None = None
    priority: str = "routine"
    collection_datetime: datetime | None = None
    notes: str | None = None
    test_definition_ids: list[uuid.UUID]


class LabTestOrderOut(BaseModel):
    id: uuid.UUID
    test_definition_id: uuid.UUID
    test_name: str
    status: str
    ordered_at: datetime


class LabResultOut(BaseModel):
    id: uuid.UUID
    test_order_id: uuid.UUID
    result_value: str
    numeric_value: Decimal | None
    instrument_id: uuid.UUID | None
    unit: str | None
    flag: str | None
    status: str
    entered_by_user_id: uuid.UUID
    entered_at: datetime
    validated_by_user_id: uuid.UUID | None
    validated_at: datetime | None
    authorized_by_user_id: uuid.UUID | None
    authorized_at: datetime | None

    class Config:
        from_attributes = True


class LabSampleOut(BaseModel):
    id: uuid.UUID
    sample_number: str
    client_id: uuid.UUID
    client_name: str
    sample_type_id: uuid.UUID
    container_id: uuid.UUID | None
    priority: str
    status: str
    collection_datetime: datetime | None
    received_datetime: datetime | None
    rejection_reason: str | None
    notes: str | None
    current_location_id: uuid.UUID | None
    current_location_name: str | None
    created_at: datetime


class LabSampleDetail(LabSampleOut):
    test_orders: list[LabTestOrderOut]
    results: list[LabResultOut]


class LabResultEntry(BaseModel):
    result_value: str


class LabRejectRequest(BaseModel):
    reason: str


class LabReportOut(BaseModel):
    id: uuid.UUID
    sample_id: uuid.UUID
    report_number: str
    version: int
    status: str
    generated_at: datetime
    released_by_user_id: uuid.UUID
    superseded_by_report_id: uuid.UUID | None

    class Config:
        from_attributes = True


class QcReferenceSampleCreate(BaseModel):
    test_definition_id: uuid.UUID
    qc_type: str
    name: str
    lot_number: str | None = None
    expiry_date: date | None = None
    expected_low: Decimal | None = None
    expected_high: Decimal | None = None


class QcReferenceSampleOut(BaseModel):
    id: uuid.UUID
    test_definition_id: uuid.UUID
    qc_type: str
    name: str
    lot_number: str | None
    expiry_date: date | None
    expected_low: Decimal | None
    expected_high: Decimal | None
    is_active: bool

    class Config:
        from_attributes = True


class QcReferenceRunCreate(BaseModel):
    reference_sample_id: uuid.UUID
    result_value: str
    worksheet_id: uuid.UUID | None = None


class QcDuplicateRunCreate(BaseModel):
    source_test_order_id: uuid.UUID
    result_value: str
    worksheet_id: uuid.UUID | None = None


class QcRunOut(BaseModel):
    id: uuid.UUID
    test_definition_id: uuid.UUID
    qc_type: str
    worksheet_id: uuid.UUID | None
    reference_sample_id: uuid.UUID | None
    source_test_order_id: uuid.UUID | None
    result_value: str
    numeric_value: Decimal | None
    rpd_percent: Decimal | None
    status: str
    performed_by_user_id: uuid.UUID
    performed_at: datetime

    class Config:
        from_attributes = True


class WorksheetCreate(BaseModel):
    test_definition_id: uuid.UUID
    analyst_user_id: uuid.UUID | None = None


class WorksheetOut(BaseModel):
    id: uuid.UUID
    worksheet_number: str
    test_definition_id: uuid.UUID
    test_name: str
    status: str
    analyst_user_id: uuid.UUID | None
    created_by_user_id: uuid.UUID
    completed_at: datetime | None
    created_at: datetime


class WorksheetTestOrderOut(BaseModel):
    id: uuid.UUID
    test_definition_id: uuid.UUID
    test_name: str
    status: str
    ordered_at: datetime
    sample_id: uuid.UUID
    sample_number: str
    client_name: str
    worksheet_id: uuid.UUID | None


class WorksheetDetail(WorksheetOut):
    test_orders: list[WorksheetTestOrderOut]
    qc_runs: list[QcRunOut]


class WorksheetAddTestOrder(BaseModel):
    test_order_id: uuid.UUID


class LabInstrumentCreate(BaseModel):
    code: str
    name: str
    manufacturer: str | None = None
    model: str | None = None


class LabInstrumentOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    manufacturer: str | None
    model: str | None
    is_active: bool

    class Config:
        from_attributes = True


class InstrumentImportRowOutcome(BaseModel):
    row: int
    status: str
    message: str | None
    sample_number: str
    test_code: str
    result_id: uuid.UUID | None = None


class InstrumentImportResponse(BaseModel):
    instrument_id: uuid.UUID
    imported_count: int
    error_count: int
    rows: list[InstrumentImportRowOutcome]


class LabStorageLocationCreate(BaseModel):
    parent_location_id: uuid.UUID | None = None
    code: str
    name: str
    location_type: str
    temperature_c: Decimal | None = None


class LabStorageLocationOut(BaseModel):
    id: uuid.UUID
    parent_location_id: uuid.UUID | None
    parent_name: str | None
    code: str
    name: str
    location_type: str
    temperature_c: Decimal | None
    is_active: bool


class CustodyEventCreate(BaseModel):
    event_type: str
    to_location_id: uuid.UUID | None = None
    notes: str | None = None


class CustodyEventOut(BaseModel):
    id: uuid.UUID
    sample_id: uuid.UUID
    event_type: str
    from_location_id: uuid.UUID | None
    from_location_name: str | None
    to_location_id: uuid.UUID | None
    to_location_name: str | None
    performed_by_user_id: uuid.UUID
    performed_at: datetime
    notes: str | None
