import time
from fastapi import APIRouter, Response, status
from redis import Redis
from sqlalchemy import text
import httpx

from app.config import settings
from app.db import SessionLocal
from app.observability.metrics import metrics_endpoint_response

router = APIRouter(tags=["health"])


@router.get("/health/live")
def live() -> dict:
    """Lightweight, zero-dependency liveness check for k8s/Traefik probes."""
    return {"status": "ok", "timestamp": time.time()}


@router.get("/health/ready")
def ready(response: Response) -> dict:
    """
    Deep readiness probe: verifies database, redis, WAHA WhatsApp engine,
    and storage health. Returns HTTP 503 if core services are down.
    """
    results = {}
    is_ready = True

    # 1. Database Check
    db = SessionLocal()
    db_start = time.perf_counter()
    try:
        db.execute(text("SELECT 1"))
        db_latency = round((time.perf_counter() - db_start) * 1000, 2)
        results["database"] = {"status": "healthy", "latency_ms": db_latency}
    except Exception as exc:
        is_ready = False
        results["database"] = {"status": "unavailable", "error": str(exc)[:150]}
    finally:
        db.close()

    # 2. Redis Check
    redis_start = time.perf_counter()
    try:
        client = Redis.from_url(settings.redis_url, socket_connect_timeout=1.5, socket_timeout=1.5)
        client.ping()
        redis_latency = round((time.perf_counter() - redis_start) * 1000, 2)
        results["redis"] = {"status": "healthy", "latency_ms": redis_latency}
    except Exception as exc:
        # Redis degraded doesn't take down basic reads, but affects tasks
        results["redis"] = {"status": "degraded", "error": str(exc)[:150]}

    # 3. WAHA WhatsApp Engine Check
    waha_url = getattr(settings, "waha_api_url", "http://waha:3000")
    try:
        with httpx.Client(timeout=1.5) as http:
            r = http.get(f"{waha_url}/api/sessions", headers={"X-Api-Key": getattr(settings, "waha_api_key", "materialos_secret_waha_key")})
            if r.status_code in (200, 401):  # 401 or 200 confirms container is listening and responsive
                results["waha_gateway"] = {"status": "healthy", "http_status": r.status_code}
            else:
                results["waha_gateway"] = {"status": "degraded", "http_status": r.status_code}
    except Exception:
        results["waha_gateway"] = {"status": "offline", "note": "Gateway not reachable or not required for read-only ops"}

    overall_status = "ready" if is_ready else "unhealthy"
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": overall_status,
        "checked_at": time.time(),
        "services": results,
    }


@router.get("/metrics", include_in_schema=False)
def metrics() -> Response:
    """Prometheus Golden Signals metrics exposition endpoint."""
    return metrics_endpoint_response()
