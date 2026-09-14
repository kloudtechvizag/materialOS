import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db_tenant
from app.errors import AppError, ErrorCode
from app.models.support import SupportTicket, SupportTicketMessage
from app.models.user import User
from app.schemas.support import (
    SupportMessageCreate,
    SupportMessageOut,
    SupportTicketCreate,
    SupportTicketDetail,
    SupportTicketOut,
)

router = APIRouter(prefix="/support-tickets", tags=["support"])


def _message_out(m: SupportTicketMessage) -> SupportMessageOut:
    return SupportMessageOut(
        id=str(m.id),
        body=m.body,
        author_user_id=str(m.author_user_id) if m.author_user_id else None,
        author_platform_admin_id=str(m.author_platform_admin_id) if m.author_platform_admin_id else None,
        created_at=m.created_at,
    )


def _ticket_out(t: SupportTicket) -> SupportTicketOut:
    return SupportTicketOut(id=str(t.id), subject=t.subject, status=t.status, priority=t.priority, created_at=t.created_at, updated_at=t.updated_at)


@router.get("", response_model=list[SupportTicketOut])
def list_my_tickets(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> list[SupportTicketOut]:
    tickets = db.execute(select(SupportTicket).order_by(SupportTicket.created_at.desc())).scalars().all()
    return [_ticket_out(t) for t in tickets]


@router.post("", response_model=SupportTicketDetail, status_code=201)
def create_ticket(
    payload: SupportTicketCreate, db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)
) -> SupportTicketDetail:
    ticket = SupportTicket(
        tenant_id=user.tenant_id, subject=payload.subject, priority=payload.priority, created_by_user_id=user.id,
    )
    db.add(ticket)
    db.flush()
    message = SupportTicketMessage(tenant_id=user.tenant_id, ticket_id=ticket.id, body=payload.body, author_user_id=user.id)
    db.add(message)
    db.flush()
    return SupportTicketDetail(**_ticket_out(ticket).model_dump(), messages=[_message_out(message)])


def _get_owned_ticket(db: Session, ticket_id: uuid.UUID) -> SupportTicket:
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise AppError(ErrorCode.NOT_FOUND, "Support ticket not found.", status_code=404)
    return ticket


@router.get("/{ticket_id}", response_model=SupportTicketDetail)
def get_ticket(ticket_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user: User = Depends(get_current_user)) -> SupportTicketDetail:
    ticket = _get_owned_ticket(db, ticket_id)
    messages = db.execute(
        select(SupportTicketMessage).where(SupportTicketMessage.ticket_id == ticket.id).order_by(SupportTicketMessage.created_at)
    ).scalars().all()
    return SupportTicketDetail(**_ticket_out(ticket).model_dump(), messages=[_message_out(m) for m in messages])


@router.post("/{ticket_id}/messages", response_model=SupportMessageOut, status_code=201)
def reply_to_ticket(
    ticket_id: uuid.UUID, payload: SupportMessageCreate, db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)
) -> SupportMessageOut:
    ticket = _get_owned_ticket(db, ticket_id)
    message = SupportTicketMessage(tenant_id=user.tenant_id, ticket_id=ticket.id, body=payload.body, author_user_id=user.id)
    db.add(message)
    # A tenant replying to their own resolved/closed ticket re-opens it --
    # the alternative (silently dropping into a dead ticket) is worse.
    if ticket.status in ("resolved", "closed"):
        ticket.status = "open"
    db.flush()
    return _message_out(message)
