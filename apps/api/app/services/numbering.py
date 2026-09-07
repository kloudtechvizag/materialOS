"""B7: gapless, concurrency-safe document numbering.

Uses a dedicated counter row locked with SELECT ... FOR UPDATE, never a
Postgres SEQUENCE (sequences gap on rollback, and GST auditors ask about
gaps). Numbers are stored uppercase; uniqueness is case-insensitive
because the IRP uppercases invoice numbers for IRN generation.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.numbering import DocNumberCounter, FinancialYear


def next_document_number(
    db: Session,
    *,
    company_id: uuid.UUID,
    branch_id: uuid.UUID,
    financial_year_id: uuid.UUID,
    doc_type: str,
    default_prefix: str,
    default_padding: int = 6,
) -> str:
    """Must be called inside a transaction that will commit promptly --
    the row lock is held until the caller's transaction ends.
    """
    fy = db.get(FinancialYear, financial_year_id)
    if fy is None:
        raise ValueError(f"Unknown financial_year_id {financial_year_id}")
    if fy.is_locked:
        from app.errors import AppError, ErrorCode

        raise AppError(ErrorCode.PERIOD_LOCKED, f"Financial year {fy.code} is locked.", status_code=409)

    # Idempotent row creation: ON CONFLICT DO NOTHING closes the race
    # between two concurrent first-callers for a scope that has no
    # counter row yet -- exactly one INSERT wins, both then proceed to
    # the SELECT ... FOR UPDATE below and serialize there.
    insert_stmt = pg_insert(DocNumberCounter).values(
        tenant_id=fy.tenant_id,
        company_id=company_id,
        branch_id=branch_id,
        financial_year_id=financial_year_id,
        doc_type=doc_type,
        prefix=default_prefix,
        padding=default_padding,
        current_number=0,
    )
    insert_stmt = insert_stmt.on_conflict_do_nothing(constraint="uq_doc_counters_scope")
    db.execute(insert_stmt)

    stmt = (
        select(DocNumberCounter)
        .where(
            DocNumberCounter.company_id == company_id,
            DocNumberCounter.branch_id == branch_id,
            DocNumberCounter.financial_year_id == financial_year_id,
            DocNumberCounter.doc_type == doc_type,
        )
        .with_for_update()
    )
    counter = db.execute(stmt).scalar_one()
    counter.current_number += 1
    db.flush()

    number = str(counter.current_number).zfill(counter.padding)
    return f"{counter.prefix}-{fy.code}-{number}".upper()
