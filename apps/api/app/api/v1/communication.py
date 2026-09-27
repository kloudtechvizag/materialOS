import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db, set_session_context
from app.deps import get_current_user, get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.communication import (
    CommunicationMessage,
    CommunicationTemplate,
    InboundCommunicationMessage,
    TenantCommunicationConfig,
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.communication import (
    CommunicationMessageOut,
    CommunicationTemplateCreate,
    CommunicationTemplateOut,
    CommunicationTemplateUpdate,
    SendWhatsAppMessageRequest,
    TenantCommunicationConfigOut,
    TenantCommunicationConfigUpdate,
    WhatsAppQrCodeOut,
    WhatsAppSessionStartRequest,
    WhatsAppSessionStatusOut,
)
from app.services.communication.waha import (
    WahaService,
    get_or_create_tenant_config,
)

router = APIRouter(prefix="/communication", tags=["communication"])


# -------------------------------------------------------------------------
# Tenant Communication Configuration
# -------------------------------------------------------------------------

@router.get("/config", response_model=TenantCommunicationConfigOut)
def get_config(
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("communication.view")),
) -> TenantCommunicationConfig:
    config = get_or_create_tenant_config(db, user.tenant_id)
    db.flush()
    return config


@router.put("/config", response_model=TenantCommunicationConfigOut)
def update_config(
    payload: TenantCommunicationConfigUpdate,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("communication.manage")),
) -> TenantCommunicationConfig:
    config = get_or_create_tenant_config(db, user.tenant_id)
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(config, field, val)
    db.flush()
    return config


# -------------------------------------------------------------------------
# WAHA WhatsApp Session Management
# -------------------------------------------------------------------------

@router.post("/whatsapp/session/start", response_model=WhatsAppSessionStatusOut)
def start_whatsapp_session(
    payload: WhatsAppSessionStartRequest = WhatsAppSessionStartRequest(),
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("communication.manage")),
) -> WhatsAppSessionStatusOut:
    config = get_or_create_tenant_config(db, user.tenant_id)
    status_out = WahaService.start_session(db, config, force_restart=payload.force_restart)
    db.flush()
    return status_out


@router.get("/whatsapp/session/status", response_model=WhatsAppSessionStatusOut)
def get_whatsapp_session_status(
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("communication.view")),
) -> WhatsAppSessionStatusOut:
    config = get_or_create_tenant_config(db, user.tenant_id)
    status_out = WahaService.get_status(db, config)
    db.flush()
    return status_out


@router.get("/whatsapp/session/qr", response_model=WhatsAppQrCodeOut)
def get_whatsapp_session_qr(
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("communication.view")),
) -> WhatsAppQrCodeOut:
    config = get_or_create_tenant_config(db, user.tenant_id)
    qr_out = WahaService.get_qr(db, config)
    db.flush()
    return qr_out


@router.post("/whatsapp/session/stop", response_model=WhatsAppSessionStatusOut)
def stop_whatsapp_session(
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("communication.manage")),
) -> WhatsAppSessionStatusOut:
    config = get_or_create_tenant_config(db, user.tenant_id)
    status_out = WahaService.stop_session(db, config)
    db.flush()
    return status_out


# -------------------------------------------------------------------------
# Communication Templates
# -------------------------------------------------------------------------

@router.get("/templates", response_model=list[CommunicationTemplateOut])
def list_templates(
    category: str | None = None,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("communication.view")),
) -> list[CommunicationTemplate]:
    # Ensure default templates exist
    get_or_create_tenant_config(db, user.tenant_id)
    query = select(CommunicationTemplate).filter_by(tenant_id=user.tenant_id)
    if category:
        query = query.filter_by(category=category)
    return db.execute(query.order_by(CommunicationTemplate.slug)).scalars().all()


@router.post("/templates", response_model=CommunicationTemplateOut, status_code=201)
def create_template(
    payload: CommunicationTemplateCreate,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("communication.manage")),
) -> CommunicationTemplate:
    existing = db.execute(
        select(CommunicationTemplate).filter_by(tenant_id=user.tenant_id, slug=payload.slug)
    ).scalar_one_or_none()
    if existing:
        raise AppError(ErrorCode.CONFLICT, f"Template slug '{payload.slug}' already exists.", status_code=409)

    tpl = CommunicationTemplate(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(tpl)
    db.flush()
    return tpl


@router.put("/templates/{template_id}", response_model=CommunicationTemplateOut)
def update_template(
    template_id: uuid.UUID,
    payload: CommunicationTemplateUpdate,
    db: Session = Depends(get_db_tenant),
    _user: User = Depends(require_permission("communication.manage")),
) -> CommunicationTemplate:
    tpl = db.get(CommunicationTemplate, template_id)
    if not tpl:
        raise AppError(ErrorCode.NOT_FOUND, "Template not found.", status_code=404)

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(tpl, field, val)
    db.flush()
    return tpl


# -------------------------------------------------------------------------
# Outbound Message Dispatch & Logs
# -------------------------------------------------------------------------

@router.post("/whatsapp/send", response_model=CommunicationMessageOut)
def send_whatsapp_message(
    payload: SendWhatsAppMessageRequest,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("communication.create")),
) -> CommunicationMessage:
    config = get_or_create_tenant_config(db, user.tenant_id)

    # Render template or use direct text
    rendered_text = payload.message_text or ""
    if payload.template_slug:
        tpl = db.execute(
            select(CommunicationTemplate).filter_by(tenant_id=user.tenant_id, slug=payload.template_slug)
        ).scalar_one_or_none()
        if tpl:
            rendered_text = tpl.whatsapp_body
            for key, val in payload.variables.items():
                rendered_text = rendered_text.replace(f"{{{{{key}}}}}", str(val))

    if not rendered_text.strip():
        raise AppError(ErrorCode.VALIDATION_ERROR, "Either message_text or a valid template_slug is required.", status_code=400)

    if payload.media_url and payload.media_filename:
        msg = WahaService.send_file_message(
            db,
            config,
            recipient_phone=payload.recipient_phone,
            file_url=payload.media_url,
            filename=payload.media_filename,
            caption=rendered_text,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            recipient_name=payload.recipient_name,
        )
    else:
        msg = WahaService.send_text_message(
            db,
            config,
            recipient_phone=payload.recipient_phone,
            text=rendered_text,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            recipient_name=payload.recipient_name,
            template_slug=payload.template_slug,
        )

    db.flush()
    return msg


@router.get("/messages", response_model=list[CommunicationMessageOut])
def list_messages(
    recipient_phone: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("communication.view")),
) -> list[CommunicationMessage]:
    query = select(CommunicationMessage).filter_by(tenant_id=user.tenant_id)
    if recipient_phone:
        query = query.filter(CommunicationMessage.recipient_phone.contains(recipient_phone))
    return db.execute(query.order_by(CommunicationMessage.created_at.desc()).limit(limit)).scalars().all()


# -------------------------------------------------------------------------
# Inbound Webhooks (WAHA Event Receiver)
# -------------------------------------------------------------------------

@router.post("/webhooks/waha")
async def waha_webhook_handler(
    request: Request,
    tenant_id: uuid.UUID = Query(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Receives real-time events from WAHA (message, session.status, message.ack).
    Validates tenant context and logs inbound interactions for AI Copilot routing.
    """
    try:
        body = await request.json()
    except Exception:
        return {"status": "ignored", "reason": "empty_payload"}

    event = body.get("event")
    session_name = body.get("session")
    payload = body.get("payload", {})

    # If tenant_id not in query, resolve from session_name (e.g. tenant_c0123...)
    target_tenant_id = tenant_id
    if not target_tenant_id and session_name:
        conf = db.execute(
            select(TenantCommunicationConfig).filter_by(waha_session_id=session_name)
        ).scalar_one_or_none()
        if conf:
            target_tenant_id = conf.tenant_id

    if not target_tenant_id:
        return {"status": "ignored", "reason": "unknown_tenant"}

    # Set session context so RLS permits querying and writing tenant rows
    set_session_context(db, tenant_id=str(target_tenant_id), user_id=None)

    # Handle status events
    if event == "session.status":
        new_status = payload.get("status")
        if new_status:
            conf = db.execute(
                select(TenantCommunicationConfig).filter_by(tenant_id=target_tenant_id)
            ).scalar_one_or_none()
            if conf:
                conf.session_status = new_status
                me = payload.get("me", {})
                if me:
                    conf.phone_number = me.get("id", "").split("@")[0] or conf.phone_number
                    conf.push_name = me.get("pushName") or conf.push_name
                db.commit()

    # Handle delivery acks
    elif event in ("message.ack", "ack"):
        ack_status = payload.get("ackName") or payload.get("status")  # sent|delivered|read
        msg_id = payload.get("id", {}).get("id") or payload.get("id")
        if msg_id:
            msg = db.execute(
                select(CommunicationMessage).filter_by(tenant_id=target_tenant_id, provider_message_id=msg_id)
            ).scalar_one_or_none()
            if msg:
                if ack_status == "READ":
                    msg.status = "read"
                elif ack_status == "DEVICE" or ack_status == "DELIVERED":
                    msg.status = "delivered"
                db.commit()

    # Handle inbound message
    elif event == "message":
        # Don't process our own outbound echoes
        from_me = payload.get("fromMe", False)
        if not from_me:
            sender = payload.get("from", "").split("@")[0]
            text = payload.get("body", "")
            msg_wamid = payload.get("id")

            inbound = InboundCommunicationMessage(
                tenant_id=target_tenant_id,
                sender_phone=sender,
                sender_name=payload.get("_data", {}).get("notifyName"),
                channel="whatsapp",
                message_id=msg_wamid,
                message_text=text,
                raw_payload=payload,
            )
            db.add(inbound)
            db.commit()

    return {"status": "ok", "event": event}
