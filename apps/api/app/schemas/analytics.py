import uuid
from decimal import Decimal

from pydantic import BaseModel


class AnalyticsOverviewOut(BaseModel):
    total_active_students: int
    attendance_pct_last_30_days: float | None
    fee_collection_pct: float | None
    fee_invoiced_total: Decimal
    fee_collected_total: Decimal
    library_books_issued: int
    transport_students_assigned: int
    transport_routes: int
    hostel_occupancy_pct: float | None
    hostel_occupied_beds: int
    hostel_total_beds: int


class AttendanceTrendPointOut(BaseModel):
    date: str
    attendance_pct: float


class AttendanceByClassOut(BaseModel):
    school_class_id: uuid.UUID
    school_class_name: str
    attendance_pct: float


class FeeCollectionByClassOut(BaseModel):
    school_class_id: uuid.UUID
    school_class_name: str
    invoiced: Decimal
    collected: Decimal


class ExamPerformanceOut(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    average_pct: float | None
    students_marked: int


class HomeworkCompletionOut(BaseModel):
    section_id: uuid.UUID
    section_label: str
    completion_pct: float
    tracked_submissions: int
