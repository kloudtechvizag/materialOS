import uuid
from decimal import Decimal

from pydantic import BaseModel


class FeatureOut(BaseModel):
    code: str
    name: str
    category: str
    description: str | None

    class Config:
        from_attributes = True


class PlanOut(BaseModel):
    id: uuid.UUID
    slug: str
    version: int
    name: str
    description: str | None
    tier_order: int
    is_public: bool
    is_default_signup_plan: bool
    currency: str
    monthly_price: Decimal | None
    yearly_price: Decimal | None
    trial_days: int
    features: list[str]
    limits: dict[str, int | None]

    class Config:
        from_attributes = True


class AddonOfferingOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    category: str
    feature_code: str | None
    limit_key: str | None
    limit_delta: int | None
    monthly_price: Decimal
    yearly_price: Decimal

    class Config:
        from_attributes = True


class PlanCompareOut(BaseModel):
    plans: list[dict]
    limits: list[dict]
    features: list[dict]
