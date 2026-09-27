"""Background job runner (Part E: Redis + Celery). ADR-013 is the
first real usage: backup (app.services.backup_tasks) and notification
delivery/retry (app.services.notification_delivery). `include` is
required -- without it the worker process (`celery -A app.celery_app
worker`) never imports these modules and so never registers their
`@celery_app.task`-decorated functions, silently accepting jobs it
doesn't know how to run.
"""

from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "materialos",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.services.backup_tasks", "app.services.notification_delivery", "app.services.billing_tasks", "app.services.webhooks"],
)
celery_app.conf.update(task_serializer="json", accept_content=["json"], result_serializer="json")

# sec3's own default recommendation: daily full backup. Requires a
# `celery -A app.celery_app beat` process running alongside the worker
# (see docker-compose.yml's `beat` service) -- the worker alone only
# executes tasks it's handed, it doesn't schedule anything itself.
celery_app.conf.beat_schedule = {
    "daily-tenant-backups": {
        "task": "app.services.backup_tasks.run_scheduled_backups_task",
        "schedule": crontab(hour=2, minute=0),  # 02:00 server time, matching sec2's own example
    },
    # ADR-014: trial/grace/expiry progression and renewal invoice
    # generation -- runs after backups so a tenant's own backup exists
    # before anything billing-related touches their data.
    "daily-subscription-lifecycle": {
        "task": "app.services.billing_tasks.run_subscription_lifecycle_task",
        "schedule": crontab(hour=3, minute=0),
    },
}

# ---------------------------------------------------------------------------
# Celery Observability Signals (OTel Trace & Metrics Correlation)
# ---------------------------------------------------------------------------
import logging
import time
import uuid
from celery.signals import task_prerun, task_postrun, worker_init
from app.observability.logging import (
    setup_observability_logging,
    request_id_ctx,
    trace_id_ctx,
    span_id_ctx,
)
from app.observability.metrics import CELERY_TASK_DURATION_SECONDS
from app.observability.tracing import extract_traceparent

logger = logging.getLogger("materialos.celery")
_TASK_START_TIMES: dict[str, float] = {}


@worker_init.connect
def on_worker_init(**kwargs):
    setup_observability_logging()
    logger.info("Celery worker observability initialized with JSON logging")


@task_prerun.connect
def on_task_prerun(task_id=None, task=None, args=None, kwargs=None, **other):
    _TASK_START_TIMES[task_id] = time.perf_counter()

    # Extract or generate trace correlation
    headers = getattr(task.request, "headers", None) or {}
    trace_id, span_id = extract_traceparent(headers)
    req_id = headers.get("X-Request-ID") or f"celery_{task_id[:12]}"

    request_id_ctx.set(req_id)
    trace_id_ctx.set(trace_id)
    span_id_ctx.set(span_id)

    logger.info(
        f"Starting task {task.name}[{task_id}]",
        extra={"task_name": task.name, "task_id": task_id, "queue": getattr(task.request, "delivery_info", {}).get("routing_key")},
    )


@task_postrun.connect
def on_task_postrun(task_id=None, task=None, state=None, **other):
    start = _TASK_START_TIMES.pop(task_id, None)
    duration_s = (time.perf_counter() - start) if start else 0.0
    duration_ms = round(duration_s * 1000, 2)

    CELERY_TASK_DURATION_SECONDS.labels(task_name=task.name).observe(duration_s)

    logger.info(
        f"Completed task {task.name}[{task_id}] state={state} ({duration_ms}ms)",
        extra={"task_name": task.name, "task_id": task_id, "state": state, "duration_ms": duration_ms},
    )

