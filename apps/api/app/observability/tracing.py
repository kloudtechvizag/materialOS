import re
import uuid
from typing import Dict, Optional, Tuple

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

# Initialize global OpenTelemetry TracerProvider once
_RESOURCE = Resource.create({
    "service.name": "materialos-api",
    "service.version": "0.1.0",
    "deployment.environment": "production",
})

_PROVIDER = TracerProvider(resource=_RESOURCE)
trace.set_tracer_provider(_PROVIDER)
_TRACER = trace.get_tracer("materialos-api", "0.1.0")
_PROPAGATOR = TraceContextTextMapPropagator()

# Regex to validate standard W3C traceparent (version-trace_id-parent_id-trace_flags)
_TRACEPARENT_RE = re.compile(r"^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$")


def get_tracer():
    return _TRACER


def get_current_trace_and_span_id() -> Tuple[Optional[str], Optional[str]]:
    """Returns current active (trace_id, span_id) as 32-char and 16-char hex strings."""
    span = trace.get_current_span()
    ctx = span.get_span_context() if span else None
    if ctx and ctx.is_valid:
        trace_id = f"{ctx.trace_id:032x}"
        span_id = f"{ctx.span_id:016x}"
        return trace_id, span_id
    return None, None


def extract_traceparent(headers: Dict[str, str]) -> Tuple[str, str]:
    """
    Extracts W3C traceparent header or generates a fresh (trace_id, span_id).
    Format: 00-{trace_id}-{span_id}-{flags}
    """
    traceparent = headers.get("traceparent") or headers.get("Traceparent")
    if traceparent:
        match = _TRACEPARENT_RE.match(traceparent.strip().lower())
        if match:
            return match.group(1), match.group(2)

    # Generate fresh W3C compatible IDs if not present or invalid
    fresh_trace_id = uuid.uuid4().hex
    fresh_span_id = uuid.uuid4().hex[:16]
    return fresh_trace_id, fresh_span_id


def inject_traceparent(headers: Dict[str, str], trace_id: Optional[str] = None, span_id: Optional[str] = None) -> Dict[str, str]:
    """
    Injects W3C traceparent header into outgoing headers dictionary
    (e.g., for WAHA calls, SMS calls, or background tasks).
    """
    current_trace, current_span = get_current_trace_and_span_id()
    t_id = trace_id or current_trace or uuid.uuid4().hex
    s_id = span_id or current_span or uuid.uuid4().hex[:16]
    headers["traceparent"] = f"00-{t_id}-{s_id}-01"
    return headers
