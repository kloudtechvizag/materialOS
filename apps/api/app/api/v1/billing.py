import json
import uuid

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.billing import service as billing_service
from app.billing.gateway import get_payment_provider, is_sandbox
from app.db import session_scope, set_session_context
from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.user import User
from app.schemas.subscriptions import CheckoutOut, CheckoutRequest, SimulatePaymentRequest, SubscriptionPaymentOut

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/checkout", response_model=CheckoutOut)
def checkout(payload: CheckoutRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("billing.manage"))) -> CheckoutOut:
    payment, order = billing_service.checkout(db, tenant_id=user.tenant_id, invoice_id=payload.invoice_id)
    return CheckoutOut(
        payment=SubscriptionPaymentOut.model_validate(payment), provider=payment.provider,
        order_id=order.order_id, amount=order.amount, currency=order.currency, is_sandbox=is_sandbox(),
    )


@router.post("/checkout/{payment_id}/simulate", response_model=SubscriptionPaymentOut)
def simulate_checkout(
    payment_id: uuid.UUID, payload: SimulatePaymentRequest,
    db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("billing.manage")),
) -> SubscriptionPaymentOut:
    """Sandbox-only dev/demo helper standing in for the real gateway's
    async callback (spec sec31) -- see billing/service.py's
    simulate_payment_result docstring. Refuses if a live provider is
    configured."""
    payment = billing_service.simulate_payment_result(db, tenant_id=user.tenant_id, payment_id=payment_id, succeed=payload.succeed)
    return payment


@router.post("/webhooks")
async def webhooks(request: Request, x_webhook_signature: str | None = Header(default=None)) -> dict:
    """Server-authoritative activation path (spec sec31/61) -- no bearer
    token (the gateway calls this, not a logged-in user), so this opens
    its own session and sets RLS context from the payload's own
    tenant_id once the signature is verified. Real Razorpay webhooks
    echo back whatever `notes` metadata the order was created with;
    this sandbox-shaped payload carries tenant_id in the same spirit.
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
        payment = billing_service.handle_webhook(db, event=event)
        return {"status": "ok", "payment_id": str(payment.id)}
