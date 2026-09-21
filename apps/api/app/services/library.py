import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.education import Student
from app.models.library import Book, BookCopy, BookIssue

FINE_PER_DAY = Decimal("2")


def create_book(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, title: str, author: str | None, isbn: str | None, publisher: str | None, category: str | None) -> Book:
    book = Book(tenant_id=tenant_id, company_id=company_id, title=title, author=author, isbn=isbn, publisher=publisher, category=category)
    db.add(book)
    db.flush()
    return book


def list_books(db: Session, *, tenant_id: uuid.UUID) -> list[Book]:
    return db.execute(select(Book).where(Book.tenant_id == tenant_id).order_by(Book.title)).scalars().all()


def _book(db: Session, tenant_id: uuid.UUID, book_id: uuid.UUID) -> Book:
    book = db.get(Book, book_id)
    if book is None or book.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Book not found.", status_code=404)
    return book


def create_copy(db: Session, *, tenant_id: uuid.UUID, book_id: uuid.UUID, accession_number: str) -> BookCopy:
    _book(db, tenant_id, book_id)
    copy = BookCopy(tenant_id=tenant_id, book_id=book_id, accession_number=accession_number)
    db.add(copy)
    db.flush()
    return copy


def list_copies(db: Session, *, tenant_id: uuid.UUID, book_id: uuid.UUID) -> list[BookCopy]:
    _book(db, tenant_id, book_id)
    return db.execute(
        select(BookCopy).where(BookCopy.tenant_id == tenant_id, BookCopy.book_id == book_id).order_by(BookCopy.accession_number)
    ).scalars().all()


def _issue_out(db: Session, issue: BookIssue) -> dict:
    copy = db.get(BookCopy, issue.book_copy_id)
    book = db.get(Book, copy.book_id)
    return {
        "id": issue.id, "book_copy_id": issue.book_copy_id, "student_id": issue.student_id,
        "issued_date": issue.issued_date, "due_date": issue.due_date, "returned_date": issue.returned_date,
        "status": issue.status, "fine_amount": issue.fine_amount, "fine_paid": issue.fine_paid,
        "is_overdue": issue.status == "issued" and issue.due_date < date.today(),
        "book_title": book.title, "accession_number": copy.accession_number,
    }


def issue_book(db: Session, *, tenant_id: uuid.UUID, book_copy_id: uuid.UUID, student_id: uuid.UUID, due_date: date) -> dict:
    copy = db.get(BookCopy, book_copy_id)
    if copy is None or copy.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Book copy not found.")
    if copy.status != "available":
        raise AppError(ErrorCode.CONFLICT, f"This copy is currently '{copy.status}', not available to issue.", status_code=409)

    student = db.get(Student, student_id)
    if student is None or student.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Student not found.")

    if due_date < date.today():
        raise AppError(ErrorCode.VALIDATION_ERROR, "Due date cannot be in the past.")

    issue = BookIssue(tenant_id=tenant_id, book_copy_id=book_copy_id, student_id=student_id, issued_date=date.today(), due_date=due_date)
    db.add(issue)
    copy.status = "issued"
    db.flush()
    return _issue_out(db, issue)


def return_book(db: Session, *, tenant_id: uuid.UUID, book_issue_id: uuid.UUID, fine_amount: Decimal | None, lost: bool) -> dict:
    issue = db.get(BookIssue, book_issue_id)
    if issue is None or issue.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Book issue not found.", status_code=404)
    if issue.status != "issued":
        raise AppError(ErrorCode.CONFLICT, "This book has already been returned or marked lost.", status_code=409)

    copy = db.get(BookCopy, issue.book_copy_id)
    today = date.today()

    if lost:
        issue.status = "lost"
        copy.status = "lost"
        issue.fine_amount = fine_amount if fine_amount is not None else Decimal("0")
    else:
        issue.status = "returned"
        issue.returned_date = today
        copy.status = "available"
        overdue_days = max((today - issue.due_date).days, 0)
        issue.fine_amount = fine_amount if fine_amount is not None else (FINE_PER_DAY * overdue_days)

    db.flush()
    return _issue_out(db, issue)


def list_active_issues(db: Session, *, tenant_id: uuid.UUID) -> list[dict]:
    issues = db.execute(
        select(BookIssue).where(BookIssue.tenant_id == tenant_id, BookIssue.status == "issued").order_by(BookIssue.due_date)
    ).scalars().all()
    return [_issue_out(db, i) for i in issues]


def get_student_library_history(db: Session, *, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[dict]:
    issues = db.execute(
        select(BookIssue).where(BookIssue.tenant_id == tenant_id, BookIssue.student_id == student_id).order_by(BookIssue.issued_date.desc())
    ).scalars().all()
    return [_issue_out(db, i) for i in issues]
