"""sec39-40: real, live checks against this deployment's actual
dependencies -- never a hardcoded "all green". Each check is cheap
(a ping/roundtrip, not a load test) and independently try/excepted so
one dead dependency doesn't take the whole endpoint down with a 500,
which would be a worse failure mode than an honest "degraded" row.

Integrations (WhatsApp/SMS/email/payment gateway) aren't included here
as separate rows -- per ADR-007/009/013, none of those have real
provider credentials configured in any environment this runs in yet,
so a health check for them would only ever report "not configured",
which notifications.py's channel status already covers without a
second parallel "integration health" concept.
"""

import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.config import settings
from app.deps import get_db_tenant, require_permission
from app.storage import read_file, save_file

router = APIRouter(prefix="/system-health", tags=["operations"])


class ComponentHealth(BaseModel):
    name: str
    status: str  # healthy | degraded | unavailable
    latency_ms: int | None = None
    detail: str | None = None


class SystemHealthOut(BaseModel):
    checked_at: datetime
    overall: str  # healthy | degraded | unavailable
    components: list[ComponentHealth]


def check_database(db: Session) -> ComponentHealth:
    start = time.monotonic()
    try:
        db.execute(text("SELECT 1"))
        return ComponentHealth(name="database", status="healthy", latency_ms=int((time.monotonic() - start) * 1000))
    except Exception as exc:  # noqa: BLE001 -- this is exactly the boundary that must not raise
        return ComponentHealth(name="database", status="unavailable", detail=str(exc)[:200])


def check_redis() -> ComponentHealth:
    start = time.monotonic()
    try:
        client = Redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        return ComponentHealth(name="redis", status="healthy", latency_ms=int((time.monotonic() - start) * 1000))
    except RedisError as exc:
        return ComponentHealth(name="redis", status="unavailable", detail=str(exc)[:200])
    except Exception as exc:  # noqa: BLE001
        return ComponentHealth(name="redis", status="unavailable", detail=str(exc)[:200])


def check_storage() -> ComponentHealth:
    start = time.monotonic()
    try:
        probe_tenant = uuid.uuid4()  # not a real tenant -- this is a throwaway probe file only
        content = b"health-check-probe"
        path = save_file(tenant_id=probe_tenant, category="_health_probe", file_name="probe.txt", content=content)
        read_back = read_file(path)
        if read_back != content:
            return ComponentHealth(name="object_storage", status="degraded", detail="Read-back content mismatch")
        return ComponentHealth(name="object_storage", status="healthy", latency_ms=int((time.monotonic() - start) * 1000))
    except Exception as exc:  # noqa: BLE001
        return ComponentHealth(name="object_storage", status="unavailable", detail=str(exc)[:200])


def check_celery_worker() -> ComponentHealth:
    start = time.monotonic()
    try:
        pong = celery_app.control.inspect(timeout=2.0).ping()
        if not pong:
            return ComponentHealth(name="background_worker", status="unavailable", detail="No worker responded to ping")
        return ComponentHealth(
            name="background_worker", status="healthy",
            latency_ms=int((time.monotonic() - start) * 1000), detail=f"{len(pong)} worker(s)",
        )
    except Exception as exc:  # noqa: BLE001
        return ComponentHealth(name="background_worker", status="unavailable", detail=str(exc)[:200])


@router.get("", response_model=SystemHealthOut)
def get_system_health(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("system_health.view"))
) -> SystemHealthOut:
    components = [check_database(db), check_redis(), check_storage(), check_celery_worker()]
    if any(c.status == "unavailable" for c in components):
        overall = "unavailable" if all(c.status == "unavailable" for c in components) else "degraded"
    elif any(c.status == "degraded" for c in components):
        overall = "degraded"
    else:
        overall = "healthy"
    return SystemHealthOut(checked_at=datetime.now(timezone.utc), overall=overall, components=components)
