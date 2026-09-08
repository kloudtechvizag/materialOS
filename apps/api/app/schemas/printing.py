import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class PrintMachineOut(BaseModel):
    id: uuid.UUID
    name: str
    machine_type: str
    capacity_per_hour: Decimal | None
    capacity_unit: str | None
    hourly_cost: Decimal
    status: str
    is_active: bool

    class Config:
        from_attributes = True


class PrintMachineCreate(BaseModel):
    name: str
    machine_type: str
    capacity_per_hour: Decimal | None = None
    capacity_unit: str | None = None
    hourly_cost: Decimal = Decimal("0")


class PrintMachineStatusUpdate(BaseModel):
    status: str


class PrintJobArtworkOut(BaseModel):
    id: uuid.UUID
    print_job_id: uuid.UUID
    version_number: int
    file_name: str
    status: str
    comments: str | None
    approved_at: datetime | None

    class Config:
        from_attributes = True


class PrintJobOut(BaseModel):
    id: uuid.UUID
    number: str
    customer_id: uuid.UUID
    project_id: uuid.UUID | None
    item_id: uuid.UUID | None
    job_type: str
    specification: dict
    quantity: Decimal
    machine_id: uuid.UUID | None
    media_item_id: uuid.UUID | None
    media_qty: Decimal | None
    warehouse_id: uuid.UUID | None
    status: str
    priority: str
    due_date: date | None
    delivery_mode: str | None
    is_outsourced: bool
    outsource_vendor_id: uuid.UUID | None
    outsource_cost: Decimal
    material_cost: Decimal
    printing_cost: Decimal
    finishing_cost: Decimal
    labor_cost: Decimal
    wastage_cost: Decimal
    finishing_ops: list
    quoted_price: Decimal
    gst_rate: Decimal
    qc_status: str | None
    qc_notes: str | None
    rework_of_job_id: uuid.UUID | None
    invoice_id: uuid.UUID | None
    notes: str | None

    class Config:
        from_attributes = True


class PrintJobCreate(BaseModel):
    customer_id: uuid.UUID
    project_id: uuid.UUID | None = None
    item_id: uuid.UUID | None = None
    job_type: str
    specification: dict = {}
    quantity: Decimal = Decimal("1")
    machine_id: uuid.UUID | None = None
    media_item_id: uuid.UUID | None = None
    media_qty: Decimal | None = None
    warehouse_id: uuid.UUID | None = None
    priority: str = "normal"
    due_date: date | None = None
    quoted_price: Decimal = Decimal("0")
    gst_rate: Decimal = Decimal("0")
    notes: str | None = None


class PrintJobUpdate(BaseModel):
    material_cost: Decimal | None = None
    printing_cost: Decimal | None = None
    finishing_cost: Decimal | None = None
    labor_cost: Decimal | None = None
    wastage_cost: Decimal | None = None
    finishing_ops: list | None = None
    quoted_price: Decimal | None = None
    priority: str | None = None
    due_date: date | None = None
    machine_id: uuid.UUID | None = None
    qc_status: str | None = None
    qc_notes: str | None = None
    is_outsourced: bool | None = None
    outsource_vendor_id: uuid.UUID | None = None
    outsource_cost: Decimal | None = None
    delivery_mode: str | None = None
    notes: str | None = None


class PrintJobStatusUpdate(BaseModel):
    status: str


class CompleteJobRequest(BaseModel):
    payment_amount: Decimal | None = None
    payment_mode: str | None = None


class JobProfitabilityOut(BaseModel):
    revenue: Decimal
    material_cost: Decimal
    printing_cost: Decimal
    finishing_cost: Decimal
    labor_cost: Decimal
    outsourcing_cost: Decimal
    wastage_cost: Decimal
    total_cost: Decimal
    gross_profit: Decimal
    margin_pct: Decimal
