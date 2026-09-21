import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class FeeHeadOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str

    class Config:
        from_attributes = True


class FeeHeadCreate(BaseModel):
    name: str
    code: str


class FeeStructureItemOut(BaseModel):
    id: uuid.UUID
    academic_year_id: uuid.UUID
    school_class_id: uuid.UUID
    fee_head_id: uuid.UUID
    amount: Decimal
    due_date: date

    class Config:
        from_attributes = True


class FeeStructureItemCreate(BaseModel):
    academic_year_id: uuid.UUID
    school_class_id: uuid.UUID
    fee_head_id: uuid.UUID
    amount: Decimal
    due_date: date


class GenerateFeeInvoicesRequest(BaseModel):
    school_class_id: uuid.UUID
    branch_id: uuid.UUID
    fee_structure_item_ids: list[uuid.UUID]


class FeeInvoiceOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    academic_year_id: uuid.UUID
    invoice_id: uuid.UUID
    invoice_number: str
    invoice_date: date
    customer_id: uuid.UUID
    total: Decimal
    outstanding: Decimal


class GenerateFeeInvoicesResult(BaseModel):
    created: list[FeeInvoiceOut]
    skipped_student_ids: list[uuid.UUID]
