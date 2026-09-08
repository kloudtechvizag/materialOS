"""ADR-014 + ADR-007's precedent: the PaymentProvider adapter interface
(spec sec30). Two implementations -- a real, deterministic sandbox, and
a live (Razorpay-shaped) implementation that raises until real
credentials are configured. Nothing above this module knows which one
it's talking to (spec sec61: subscription/payment APIs are server-
authoritative regardless of provider).
"""

import hashlib
import hmac
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.config import settings


class NotConfiguredError(Exception):
    """Raised by the live provider until a real gateway is contracted."""


@dataclass
class OrderResult:
    order_id: str
    amount: int  # smallest currency unit (paise), matching Razorpay's own convention
    currency: str


class PaymentProvider(ABC):
    @abstractmethod
    def create_order(self, *, amount_rupees, currency: str, receipt: str) -> OrderResult: ...

    @abstractmethod
    def verify_webhook_signature(self, *, payload: bytes, signature: str) -> bool: ...


class SandboxPaymentProvider(PaymentProvider):
    """Deterministic, no network call -- order ids are prefixed
    SANDBOX_ so a sandbox order can never be mistaken for a real
    Razorpay one. Signature "verification" checks against a fixed
    dev-only secret rather than skipping the check entirely, so the
    handler code path that verifies signatures is genuinely exercised
    end to end, not special-cased around in sandbox mode.
    """

    _DEV_SECRET = b"materialos-sandbox-webhook-secret-do-not-use-in-prod"

    def create_order(self, *, amount_rupees, currency: str, receipt: str) -> OrderResult:
        order_id = f"SANDBOX_order_{uuid.uuid4().hex[:16]}"
        return OrderResult(order_id=order_id, amount=int(amount_rupees * 100), currency=currency)

    def verify_webhook_signature(self, *, payload: bytes, signature: str) -> bool:
        expected = hmac.new(self._DEV_SECRET, payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    def sign(self, payload: bytes) -> str:
        """Test/dev helper so the sandbox webhook-simulation endpoint can
        produce a signature this same class will accept."""
        return hmac.new(self._DEV_SECRET, payload, hashlib.sha256).hexdigest()


class LivePaymentProvider(PaymentProvider):
    def create_order(self, *, amount_rupees, currency: str, receipt: str):
        raise NotConfiguredError(
            "No live payment gateway is configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and "
            "RAZORPAY_WEBHOOK_SECRET, or continue using the sandbox provider."
        )

    def verify_webhook_signature(self, *, payload: bytes, signature: str) -> bool:
        raise NotConfiguredError("No live payment gateway is configured.")


def get_payment_provider() -> PaymentProvider:
    if settings.environment == "production" and settings.razorpay_key_id:
        return LivePaymentProvider()
    return SandboxPaymentProvider()


def is_sandbox() -> bool:
    return isinstance(get_payment_provider(), SandboxPaymentProvider)
