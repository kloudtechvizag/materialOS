"""dev.md §42: the dispatch board groups every in-flight order by where
it actually is -- read-only aggregation over Slice 1's SalesOrder /
DeliveryChallan status fields, no new state of its own.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import DeliveryChallan, SalesOrder


def dispatch_board(db: Session) -> dict:
    pending = db.execute(select(SalesOrder).where(SalesOrder.status == "draft")).scalars().all()
    ready_to_dispatch = db.execute(select(SalesOrder).where(SalesOrder.status == "reserved")).scalars().all()
    dispatched = db.execute(
        select(DeliveryChallan).where(DeliveryChallan.status.in_(["dispatched", "in_transit"]))
    ).scalars().all()
    delivered = db.execute(select(DeliveryChallan).where(DeliveryChallan.status == "delivered")).scalars().all()

    return {
        "pending_orders": pending,
        "ready_to_dispatch": ready_to_dispatch,
        "dispatched": dispatched,
        "delivered": delivered,
    }
