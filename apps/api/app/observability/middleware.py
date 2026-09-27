import logging
import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.observability.logging import (
    request_id_ctx,
    span_id_ctx,
    tenant_id_ctx,
    trace_id_ctx,
    user_id_ctx,
)
from app.observability.metrics import (
    HTTP_REQUEST_DURATION_SECONDS,
    HTTP_REQUESTS_IN_PROGRESS,
    HTTP_REQUESTS_TOTAL,
    normalize_metric_path,
)
from app.observability.tracing import extract_traceparent, get_tracer

logger = logging.getLogger("materialos.http")


class ObservabilityMiddleware(BaseHTTPMiddleware):
    """
    High-performance unified Observability Middleware:
    - Extracts/assigns Request ID and W3C traceparent
    - Records Prometheus Golden Signals metrics (rate, duration, in-flight, status codes)
    - Emits structured JSON access logs with trace-correlation
    - Injects X-Request-ID, X-Trace-ID, and Server-Timing response headers
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()

        # 1. Request ID correlation
        request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
        request_id_ctx.set(request_id)

        # 2. W3C Trace & Span ID correlation
        trace_id, span_id = extract_traceparent(dict(request.headers))
        trace_id_ctx.set(trace_id)
        span_id_ctx.set(span_id)

        # 3. Normalized metric path
        metric_path = normalize_metric_path(request.url.path)
        method = request.method

        # 4. Metrics In-Progress Gauge
        HTTP_REQUESTS_IN_PROGRESS.labels(method=method, path=metric_path).inc()

        status_code = 500
        tracer = get_tracer()

        # 5. OpenTelemetry span wrapper
        with tracer.start_as_current_span(
            f"{method} {metric_path}",
            attributes={
                "http.method": method,
                "http.url": str(request.url),
                "http.target": request.url.path,
                "http.request_id": request_id,
            },
        ) as span:
            try:
                response = await call_next(request)
                status_code = response.status_code
                span.set_attribute("http.status_code", status_code)
            except Exception as exc:
                span.record_exception(exc)
                logger.error(
                    "Unhandled exception during request processing",
                    exc_info=exc,
                    extra={"path": request.url.path, "method": method},
                )
                raise
            finally:
                duration_seconds = time.perf_counter() - start_time
                duration_ms = round(duration_seconds * 1000, 2)

                # Record Prometheus metrics
                HTTP_REQUESTS_IN_PROGRESS.labels(method=method, path=metric_path).dec()
                HTTP_REQUESTS_TOTAL.labels(
                    method=method, path=metric_path, status_code=str(status_code)
                ).inc()
                HTTP_REQUEST_DURATION_SECONDS.labels(method=method, path=metric_path).observe(
                    duration_seconds
                )

                # Access Log (excluding high-frequency health probes from flooding logs)
                if not request.url.path.endswith("/health/live"):
                    logger.info(
                        f"{method} {request.url.path} -> {status_code} ({duration_ms}ms)",
                        extra={
                            "http_method": method,
                            "http_path": request.url.path,
                            "http_status": status_code,
                            "duration_ms": duration_ms,
                            "client_ip": request.client.host if request.client else "unknown",
                        },
                    )

        # 6. Response Headers Injection
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Trace-ID"] = trace_id
        response.headers["Server-Timing"] = f"total;dur={duration_ms}"

        return response
