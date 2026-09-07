"""D3/D4 + ADR-007: the NIC e-way bill adapter interface."""

import random
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone

from app.config import settings


class NotConfiguredError(Exception):
    """Raised by the live gateway until real NIC access is configured."""


@dataclass
class EwbResult:
    ewb_number: str
    generated_at: datetime


class EWayBillGateway(ABC):
    @abstractmethod
    def generate_ewb(self, *, invoice_number: str, vehicle_number: str, distance_km: str) -> EwbResult: ...

    @abstractmethod
    def cancel_ewb(self, *, ewb_number: str, reason: str) -> None: ...


class SandboxEWayBillGateway(EWayBillGateway):
    """Deterministic-enough, local-only. Real EWB numbers are a 12-digit
    NIC-assigned sequence; sandbox numbers are prefixed so they are never
    mistakable for one.
    """

    def generate_ewb(self, *, invoice_number: str, vehicle_number: str, distance_km: str) -> EwbResult:
        return EwbResult(ewb_number=f"SBX{random.randint(10**8, 10**9 - 1)}", generated_at=datetime.now(timezone.utc))

    def cancel_ewb(self, *, ewb_number: str, reason: str) -> None:
        return None


class LiveEWayBillGateway(EWayBillGateway):
    def generate_ewb(self, *, invoice_number: str, vehicle_number: str, distance_km: str) -> EwbResult:
        raise NotConfiguredError(
            "No NIC e-way bill access is configured. Set EWAYBILL_NIC_BASE_URL, "
            "EWAYBILL_NIC_CLIENT_ID, and EWAYBILL_NIC_CLIENT_SECRET, or continue using the sandbox gateway."
        )

    def cancel_ewb(self, *, ewb_number: str, reason: str) -> None:
        raise NotConfiguredError("No NIC e-way bill access is configured.")


def get_gateway() -> EWayBillGateway:
    if settings.environment == "production" and settings.ewaybill_nic_base_url:
        return LiveEWayBillGateway()
    return SandboxEWayBillGateway()
