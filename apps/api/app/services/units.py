"""B2: quantity always carries (value, uom, product_id); conversions go
through this one function, never a global constant or ad-hoc arithmetic
scattered across modules.
"""

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.catalog import UnitConversion
from app.models.masters import Item


def _factor_to_base(db: Session, item: Item, uom: str) -> Decimal:
    if uom == item.base_uom:
        return Decimal("1")
    conversion = db.execute(
        select(UnitConversion).where(UnitConversion.item_id == item.id, UnitConversion.uom == uom)
    ).scalar_one_or_none()
    if conversion is None:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"No conversion defined for {item.name} in unit {uom}.",
            details={"item_id": str(item.id), "uom": uom},
        )
    return conversion.factor_to_base


def convert(db: Session, *, qty: Decimal, from_uom: str, to_uom: str, item: Item) -> Decimal:
    if from_uom == to_uom:
        return qty
    qty_in_base = qty * _factor_to_base(db, item, from_uom)
    return qty_in_base / _factor_to_base(db, item, to_uom)
