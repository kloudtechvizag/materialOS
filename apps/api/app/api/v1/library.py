import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.errors import AppError, ErrorCode
from app.models.library import Book
from app.models.tenant import Company
from app.models.user import User
from app.schemas.library import BookCopyCreate, BookCopyOut, BookCreate, BookIssueOut, BookOut, IssueBookRequest, ReturnBookRequest
from app.services.library import create_book, create_copy, get_student_library_history, issue_book, list_active_issues, list_books, list_copies, return_book

router = APIRouter(tags=["library"], dependencies=[Depends(require_module("education"))])


def _company(db: Session, tenant_id: uuid.UUID) -> Company:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    if company is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "No company configured for this tenant.")
    return company


@router.get("/library/books", response_model=list[BookOut])
def list_books_endpoint(db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("library.view"))) -> list[Book]:
    return list_books(db, tenant_id=user.tenant_id)


@router.post("/library/books", response_model=BookOut, status_code=201)
def create_book_endpoint(payload: BookCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("library.create"))) -> Book:
    company = _company(db, user.tenant_id)
    return create_book(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


@router.get("/library/books/{book_id}/copies", response_model=list[BookCopyOut])
def list_copies_endpoint(book_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("library.view"))):
    return list_copies(db, tenant_id=user.tenant_id, book_id=book_id)


@router.post("/library/books/{book_id}/copies", response_model=BookCopyOut, status_code=201)
def create_copy_endpoint(book_id: uuid.UUID, payload: BookCopyCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("library.create"))):
    return create_copy(db, tenant_id=user.tenant_id, book_id=book_id, **payload.model_dump())


@router.get("/library/issues", response_model=list[BookIssueOut])
def list_active_issues_endpoint(db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("library.view"))):
    return list_active_issues(db, tenant_id=user.tenant_id)


@router.post("/library/issues", response_model=BookIssueOut, status_code=201)
def issue_book_endpoint(payload: IssueBookRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("library.edit"))):
    return issue_book(db, tenant_id=user.tenant_id, **payload.model_dump())


@router.post("/library/issues/{book_issue_id}/return", response_model=BookIssueOut)
def return_book_endpoint(
    book_issue_id: uuid.UUID, payload: ReturnBookRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("library.edit"))
):
    return return_book(db, tenant_id=user.tenant_id, book_issue_id=book_issue_id, **payload.model_dump())


@router.get("/students/{student_id}/library", response_model=list[BookIssueOut])
def student_library_history_endpoint(student_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("library.view"))):
    return get_student_library_history(db, tenant_id=user.tenant_id, student_id=student_id)
