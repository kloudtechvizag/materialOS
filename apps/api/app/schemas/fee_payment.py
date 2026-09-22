import uuid
from decimal import Decimal

from pydantic import BaseModel


class FeePaymentOut(BaseModel):
    id: uuid.UUID
    fee_invoice_id: uuid.UUID
    provider: str
    provider_order_id: str
    provider_payment_id: str | None
    amount: Decimal
    currency: str
    status: str
    method: str | None
    failure_reason: str | None

    class Config:
        from_attributes = True


class FeeCheckoutOut(BaseModel):
    payment: FeePaymentOut
    order_id: str
    amount: int
    currency: str
    is_sandbox: bool


class SimulateFeePaymentRequest(BaseModel):
    succeed: bool = True
