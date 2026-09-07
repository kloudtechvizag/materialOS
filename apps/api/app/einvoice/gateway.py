"""D2/D4 + ADR-007: the GSP/ASP adapter interface. Two implementations:
a real, deterministic sandbox, and a live implementation that raises
until real credentials are configured. Nothing above this module knows
which one it's talking to.
"""

import hashlib
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone

from app.config import settings


class NotConfiguredError(Exception):
    """Raised by the live gateway until a real GSP is contracted."""


@dataclass
class IrnResult:
    irn: str
    ack_number: str
    ack_date: datetime
    signed_qr_code: str


class EInvoiceGateway(ABC):
    @abstractmethod
    def generate_irn(self, *, invoice_number: str, invoice_date: str, seller_gstin: str, total: str) -> IrnResult: ...

    @abstractmethod
    def cancel_irn(self, *, irn: str, reason: str) -> None: ...


class SandboxEInvoiceGateway(EInvoiceGateway):
    """Deterministic, local-only. Produces IRN-shaped values (64-char hex,
    matching the real IRP's SHA-256-based format) with no network call --
    safe for demos and tests, never mistakable for a filed document
    because ack_number is prefixed SANDBOX-.
    """

    def generate_irn(self, *, invoice_number: str, invoice_date: str, seller_gstin: str, total: str) -> IrnResult:
        digest_input = f"{seller_gstin}|{invoice_number}|{invoice_date}|{total}"
        irn = hashlib.sha256(digest_input.encode()).hexdigest()
        now = datetime.now(timezone.utc)
        return IrnResult(
            irn=irn,
            ack_number=f"SANDBOX-{uuid.uuid4().hex[:12].upper()}",
            ack_date=now,
            signed_qr_code=f"SANDBOX-QR:{irn[:32]}",
        )

    def cancel_irn(self, *, irn: str, reason: str) -> None:
        return None


class LiveEInvoiceGateway(EInvoiceGateway):
    def generate_irn(self, *, invoice_number: str, invoice_date: str, seller_gstin: str, total: str) -> IrnResult:
        raise NotConfiguredError(
            "No GSP/ASP is configured for live e-invoicing. Set EINVOICE_GSP_BASE_URL, "
            "EINVOICE_GSP_CLIENT_ID, and EINVOICE_GSP_CLIENT_SECRET, or continue using the sandbox gateway."
        )

    def cancel_irn(self, *, irn: str, reason: str) -> None:
        raise NotConfiguredError("No GSP/ASP is configured for live e-invoicing.")


def get_gateway() -> EInvoiceGateway:
    if settings.environment == "production" and settings.einvoice_gsp_base_url:
        return LiveEInvoiceGateway()
    return SandboxEInvoiceGateway()
