import json

from fastapi import APIRouter, Header, Request

from app.billing.gateway import get_payment_provider
from app.db import session_scope, set_session_context
from app.errors import AppError, ErrorCode
from app.services.fee_payment import handle_webhook

router = APIRouter(prefix="/fee-payments", tags=["fee-payments"])


@router.post("/webhooks")
async def fee_payment_webhooks(request: Request, x_webhook_signature: str | None = Header(default=None)) -> dict:
    """Same server-authoritative shape as /billing/webhooks (ADR-014) --
    no bearer token (the gateway calls this, not a logged-in guardian),
    signature-verified, opens its own session and sets RLS context from
    the payload's own tenant_id once verified. Deliberately its own
    endpoint, not reusing /billing/webhooks, since FeePayment and
    SubscriptionPayment are two separate order-id spaces.
    """
    raw_body = await request.body()
    provider = get_payment_provider()

    if not x_webhook_signature or not provider.verify_webhook_signature(payload=raw_body, signature=x_webhook_signature):
        raise AppError(ErrorCode.UNAUTHORIZED, "Invalid webhook signature.", status_code=401)

    event = json.loads(raw_body)
    tenant_id = event.get("tenant_id")
    if not tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Webhook payload is missing tenant_id.")

    with session_scope() as db:
        set_session_context(db, tenant_id=tenant_id, user_id=None)
        payment = handle_webhook(db, event=event)
        return {"status": "ok", "payment_id": str(payment.id)}
