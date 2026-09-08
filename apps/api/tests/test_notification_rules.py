"""ADR-013: the notification rule engine (sec21-22) and its first two
real trigger points -- POS checkout's stock-low check (sec20's own
example) and the backup-failed path.
"""

import uuid
from decimal import Decimal

from sqlalchemy import select

from app.models.masters import Item
from app.models.notifications import NotificationRule
from app.services.inventory import apply_ledger_movement
from app.services.notification_rules import ensure_default_notification_rules, fire_trigger
from app.services.notifications import list_notifications
from app.services.pos import WalkInSaleLine, create_walk_in_sale


def test_default_rules_seeded_and_idempotent(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    ensure_default_notification_rules(db, tenant_id=tenant.id)
    first_count = len(db.execute(
        select(NotificationRule).where(NotificationRule.tenant_id == tenant.id)
    ).scalars().all())
    from app.services.notification_rules import DEFAULT_RULES

    assert first_count == len(DEFAULT_RULES)  # ADR-013's original 4 plus ADR-014's billing/usage rules

    ensure_default_notification_rules(db, tenant_id=tenant.id)  # idempotent
    second_count = len(db.execute(
        select(NotificationRule).where(NotificationRule.tenant_id == tenant.id)
    ).scalars().all())
    assert second_count == first_count


def test_fire_trigger_only_fires_for_active_matching_rules(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    rule = NotificationRule(
        tenant_id=tenant.id, name="Test rule", trigger_type="custom_event",
        priority="warning", channels=["in_app"], is_active=True,
    )
    db.add(rule)
    db.flush()

    notifications = fire_trigger(db, tenant_id=tenant.id, trigger_type="custom_event", title="T", message="M")
    assert len(notifications) == 1
    assert notifications[0].priority == "warning"

    # No rule for an unconfigured trigger -- no notification (sec21:
    # administrators configure what they want to hear about).
    none_fired = fire_trigger(db, tenant_id=tenant.id, trigger_type="nobody_configured_this", title="T", message="M")
    assert none_fired == []

    rule.is_active = False
    db.flush()
    still_none = fire_trigger(db, tenant_id=tenant.id, trigger_type="custom_event", title="T", message="M")
    assert still_none == []


def test_fire_trigger_respects_threshold(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    rule = NotificationRule(
        tenant_id=tenant.id, name="Large amount only", trigger_type="big_invoice",
        threshold_value=Decimal("50000"), priority="critical", channels=["in_app"], is_active=True,
    )
    db.add(rule)
    db.flush()

    below = fire_trigger(db, tenant_id=tenant.id, trigger_type="big_invoice", title="T", message="M", metric_value=Decimal("10000"))
    assert below == []

    at_threshold = fire_trigger(db, tenant_id=tenant.id, trigger_type="big_invoice", title="T", message="M", metric_value=Decimal("50000"))
    assert len(at_threshold) == 1


def test_pos_checkout_fires_stock_low_when_reorder_level_crossed(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    branch = tenant_ctx["branch"]
    warehouse = tenant_ctx["warehouse"]
    user_id = uuid.uuid4()

    ensure_default_notification_rules(db, tenant_id=tenant.id)

    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku="LOWSTOCK-TEST", name="Low Stock Widget",
        base_uom="PCS", gst_rate=Decimal("18"), standard_price=Decimal("100"), standard_cost=Decimal("50"),
        reorder_level=Decimal("5"),
    )
    db.add(item)
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id,
        qty=Decimal("6"), rate=Decimal("50"), movement_type="opening",
        reference_type="test", reference_id=uuid.uuid4(), user_id=user_id,
    )

    # Selling 2 leaves 4 on hand -- at/below the reorder level of 5.
    create_walk_in_sale(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, warehouse_id=warehouse.id,
        financial_year_id=tenant_ctx["financial_year"].id, user_id=user_id, customer_id=None,
        lines=[WalkInSaleLine(item_id=item.id, qty=Decimal("2"), uom="PCS")],
        cash_amount=Decimal("236.00"), upi_amount=Decimal("0"), card_amount=Decimal("0"), tendered_amount=Decimal("236.00"),
    )

    notifications = list_notifications(db)
    stock_low = [n for n in notifications if n.notification_type == "stock_low"]
    assert len(stock_low) == 1
    assert stock_low[0].priority == "warning"
    assert "Low Stock Widget" in stock_low[0].title
