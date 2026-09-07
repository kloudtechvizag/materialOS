import uuid
from datetime import datetime, timezone
from decimal import Decimal

from app.models.field_sales import Visit
from sqlalchemy.orm import Session


def check_in(
    db: Session, *, tenant_id: uuid.UUID, customer_id: uuid.UUID, salesperson_user_id: uuid.UUID,
    latitude: Decimal | None, longitude: Decimal | None, purpose: str | None, notes: str | None,
) -> Visit:
    visit = Visit(
        tenant_id=tenant_id, customer_id=customer_id, salesperson_user_id=salesperson_user_id,
        checked_in_at=datetime.now(timezone.utc), latitude=latitude, longitude=longitude, purpose=purpose, notes=notes,
    )
    db.add(visit)
    db.flush()
    return visit
