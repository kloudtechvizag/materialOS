import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.billing_plans import Plan
from app.models.subscriptions import BillingAddress, SubscriptionInvoice, SubscriptionPayment
from app.models.user import User
from app.schemas.subscriptions import (
    AddonPurchaseRequest,
    BillingAddressIn,
    BillingAddressOut,
    CancelRequest,
    DowngradeRequest,
    SubscriptionAddonOut,
    SubscriptionAddonPurchaseOut,
    SubscriptionChangeOut,
    SubscriptionInvoiceOut,
    SubscriptionOut,
    SubscriptionPaymentOut,
    UpgradeRequest,
    UsageRow,
)
from app.services import subscriptions as subscription_service
from app.services.entitlements import get_subscription
from app.services.usage import usage_summary

router = APIRouter(prefix="/subscription", tags=["subscription"])


def _invoice_out(invoice, items: list | None = None) -> SubscriptionInvoiceOut | None:
    """SubscriptionInvoice has no ORM relationship to its items (a plain
    FK on the child side only), so `items` isn't reachable via
    from_attributes -- validate the model normally (this correctly
    reads every mapped column via its descriptor, including a nullable
    column like paid_at that's None but was never explicitly set and
    so isn't in the instance's __dict__ yet -- blindly merging
    `invoice.__dict__` doesn't see those and fails validation) then
    attach items after."""
    if invoice is None:
        return None
    return SubscriptionInvoiceOut.model_validate(invoice).model_copy(update={"items": items or []})


def _subscription_out(db: Session, subscription) -> SubscriptionOut:
    from app.api.v1.pricing import _plan_out

    plan = db.get(Plan, subscription.plan_id)
    return SubscriptionOut(
        id=subscription.id, plan=_plan_out(db, plan), status=subscription.status,
        billing_cycle=subscription.billing_cycle, current_period_start=subscription.current_period_start,
        current_period_end=subscription.current_period_end, trial_ends_at=subscription.trial_ends_at,
        grace_period_ends_at=subscription.grace_period_ends_at, cancel_at_period_end=subscription.cancel_at_period_end,
        cancelled_at=subscription.cancelled_at,
    )


@router.get("", response_model=SubscriptionOut)
def get_current_subscription(db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("subscription.view"))):
    subscription = get_subscription(db, user.tenant_id)
    if subscription is None:
        raise AppError(ErrorCode.NOT_FOUND, "No subscription found for this tenant.", status_code=404)
    return _subscription_out(db, subscription)


@router.post("/upgrade", response_model=SubscriptionChangeOut)
def upgrade(payload: UpgradeRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("subscription.manage"))):
    subscription, invoice = subscription_service.upgrade_subscription(
        db, tenant_id=user.tenant_id, new_plan_slug=payload.plan_slug, billing_cycle=payload.billing_cycle,
    )
    return SubscriptionChangeOut(
        subscription=_subscription_out(db, subscription),
        invoice=_invoice_out(invoice),
    )


@router.post("/downgrade", response_model=SubscriptionChangeOut)
def downgrade(payload: DowngradeRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("subscription.manage"))):
    subscription, invoice = subscription_service.downgrade_subscription(
        db, tenant_id=user.tenant_id, new_plan_slug=payload.plan_slug, billing_cycle=payload.billing_cycle,
    )
    return SubscriptionChangeOut(
        subscription=_subscription_out(db, subscription),
        invoice=_invoice_out(invoice),
    )


@router.post("/cancel", response_model=SubscriptionOut)
def cancel(payload: CancelRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("subscription.manage"))):
    subscription = subscription_service.cancel_subscription(db, tenant_id=user.tenant_id, at_period_end=payload.at_period_end)
    return _subscription_out(db, subscription)


@router.post("/reactivate", response_model=SubscriptionChangeOut)
def reactivate(db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("subscription.manage"))):
    subscription, invoice = subscription_service.reactivate_subscription(db, tenant_id=user.tenant_id)
    return SubscriptionChangeOut(
        subscription=_subscription_out(db, subscription),
        invoice=_invoice_out(invoice),
    )


@router.get("/addons", response_model=list[SubscriptionAddonOut])
def list_addons(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("subscription.view"))) -> list[SubscriptionAddonOut]:
    return subscription_service.list_active_addons(db, tenant_id=_user.tenant_id)


@router.post("/addons", response_model=SubscriptionAddonPurchaseOut, status_code=201)
def purchase_addon(payload: AddonPurchaseRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("subscription.manage"))):
    addon, invoice = subscription_service.purchase_addon(
        db, tenant_id=user.tenant_id, addon_offering_id=payload.addon_offering_id, billing_cycle=payload.billing_cycle,
    )
    return SubscriptionAddonPurchaseOut(addon=SubscriptionAddonOut.model_validate(addon), invoice=_invoice_out(invoice))


@router.post("/addons/{addon_id}/cancel", response_model=SubscriptionAddonOut)
def cancel_addon(addon_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("subscription.manage"))):
    return subscription_service.cancel_addon(db, tenant_id=user.tenant_id, addon_id=addon_id)


@router.get("/usage", response_model=list[UsageRow])
def get_usage(db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("subscription.view"))) -> list[UsageRow]:
    return [UsageRow(**row) for row in usage_summary(db, tenant_id=user.tenant_id)]


@router.get("/invoices", response_model=list[SubscriptionInvoiceOut])
def list_invoices(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("subscription.view"))) -> list[SubscriptionInvoiceOut]:
    invoices = db.execute(select(SubscriptionInvoice).order_by(SubscriptionInvoice.issued_at.desc())).scalars().all()
    return [_invoice_out(inv) for inv in invoices]


@router.get("/invoices/{invoice_id}", response_model=SubscriptionInvoiceOut)
def get_invoice(invoice_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("subscription.view"))) -> SubscriptionInvoice:
    from app.models.subscriptions import SubscriptionInvoiceItem

    invoice = db.get(SubscriptionInvoice, invoice_id)
    if invoice is None:
        raise AppError(ErrorCode.NOT_FOUND, "Invoice not found.", status_code=404)
    items = db.execute(select(SubscriptionInvoiceItem).where(SubscriptionInvoiceItem.subscription_invoice_id == invoice.id)).scalars().all()
    return _invoice_out(invoice, items=items)


@router.get("/payments", response_model=list[SubscriptionPaymentOut])
def list_payments(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("subscription.view"))) -> list[SubscriptionPayment]:
    return db.execute(select(SubscriptionPayment).order_by(SubscriptionPayment.created_at.desc())).scalars().all()


@router.get("/billing-address", response_model=BillingAddressOut | None)
def get_billing_address_endpoint(db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("subscription.view"))):
    return subscription_service.get_billing_address(db, user.tenant_id)


@router.put("/billing-address", response_model=BillingAddressOut)
def upsert_billing_address(payload: BillingAddressIn, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("subscription.manage"))):
    existing = subscription_service.get_billing_address(db, user.tenant_id)
    if existing is not None:
        for field, value in payload.model_dump().items():
            setattr(existing, field, value)
        db.flush()
        return existing
    address = BillingAddress(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(address)
    db.flush()
    return address
