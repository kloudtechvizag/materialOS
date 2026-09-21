import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class BookOut(BaseModel):
    id: uuid.UUID
    title: str
    author: str | None
    isbn: str | None
    publisher: str | None
    category: str | None

    class Config:
        from_attributes = True


class BookCreate(BaseModel):
    title: str
    author: str | None = None
    isbn: str | None = None
    publisher: str | None = None
    category: str | None = None


class BookCopyOut(BaseModel):
    id: uuid.UUID
    book_id: uuid.UUID
    accession_number: str
    status: str

    class Config:
        from_attributes = True


class BookCopyCreate(BaseModel):
    accession_number: str


class IssueBookRequest(BaseModel):
    book_copy_id: uuid.UUID
    student_id: uuid.UUID
    due_date: date


class ReturnBookRequest(BaseModel):
    fine_amount: Decimal | None = None
    lost: bool = False


class BookIssueOut(BaseModel):
    id: uuid.UUID
    book_copy_id: uuid.UUID
    student_id: uuid.UUID
    issued_date: date
    due_date: date
    returned_date: date | None
    status: str
    fine_amount: Decimal
    fine_paid: bool
    is_overdue: bool
    book_title: str
    accession_number: str
