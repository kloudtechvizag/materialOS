import time
from typing import Callable
from fastapi import Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

# Shared Prometheus Registry for MaterialOS
REGISTRY = CollectorRegistry(auto_describe=True)

# 1. Golden Signals — HTTP Metrics
HTTP_REQUESTS_TOTAL = Counter(
    "materialos_http_requests_total",
    "Total count of HTTP requests processed by MaterialOS API",
    ["method", "path", "status_code"],
    registry=REGISTRY,
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "materialos_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
    registry=REGISTRY,
)

HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "materialos_http_requests_in_progress",
    "Number of active HTTP requests currently being handled",
    ["method", "path"],
    registry=REGISTRY,
)

# 2. Database Connection Pool Metrics
DB_CONNECTIONS_ACTIVE = Gauge(
    "materialos_db_connections_active",
    "Active connections checked out of the database connection pool",
    registry=REGISTRY,
)

DB_CONNECTIONS_IDLE = Gauge(
    "materialos_db_connections_idle",
    "Idle database connections in the pool",
    registry=REGISTRY,
)

# 3. Business & Integrations Telemetry
WHATSAPP_MESSAGES_TOTAL = Counter(
    "materialos_whatsapp_messages_total",
    "Total WhatsApp messages processed via WAHA gateway",
    ["status", "event_type"],
    registry=REGISTRY,
)

POS_TRANSACTIONS_TOTAL = Counter(
    "materialos_pos_transactions_total",
    "Total POS sales completed",
    ["payment_mode"],
    registry=REGISTRY,
)

CELERY_TASK_DURATION_SECONDS = Histogram(
    "materialos_celery_task_duration_seconds",
    "Execution duration of background Celery tasks in seconds",
    ["task_name"],
    buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0, 120.0),
    registry=REGISTRY,
)


def normalize_metric_path(path: str) -> str:
    """
    Normalizes path to prevent high-cardinality label explosion
    (e.g., replaces UUIDs and numeric IDs with placeholders).
    """
    import re
    # Replace UUIDs
    p = re.sub(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        ":id",
        path,
        flags=re.IGNORECASE,
    )
    # Replace integers at path ends or segments
    p = re.sub(r"/\d+(/|$)", r"/:id\1", p)
    return p


def metrics_endpoint_response(*args, **kwargs) -> Response:
    """Generates standard Prometheus metrics exposition payload."""
    data = generate_latest(REGISTRY)
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)
