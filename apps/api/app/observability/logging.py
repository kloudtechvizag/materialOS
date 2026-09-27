import contextvars
import json
import logging
import re
import sys
import traceback
from datetime import datetime, timezone
from typing import Any, Dict

# Context variables for per-request tracing and tenant isolation correlation
request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")
trace_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("trace_id", default="")
span_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("span_id", default="")
tenant_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("tenant_id", default="")
user_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("user_id", default="")

# Sensitive key patterns to mask in logs
_SENSITIVE_KEY_RE = re.compile(
    r"(password|token|secret|authorization|api[_-]?key|card_number|cvv|pan|aadhaar)",
    re.IGNORECASE,
)


def sanitize_value(key: str, val: Any) -> Any:
    """Mask sensitive credentials or PII."""
    if isinstance(key, str) and _SENSITIVE_KEY_RE.search(key):
        return "********"
    if isinstance(val, dict):
        return {k: sanitize_value(k, v) for k, v in val.items()}
    if isinstance(val, list):
        return [sanitize_value("", v) for v in val]
    return val


class JsonLogFormatter(logging.Formatter):
    """
    Standard Structured JSON Log Formatter.
    Emits single-line JSON records with timestamps, log levels,
    OpenTelemetry trace/span IDs, and tenant context.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Correlated context
        req_id = request_id_ctx.get()
        if req_id:
            log_data["request_id"] = req_id

        tr_id = trace_id_ctx.get()
        if tr_id:
            log_data["trace_id"] = tr_id

        sp_id = span_id_ctx.get()
        if sp_id:
            log_data["span_id"] = sp_id

        t_id = tenant_id_ctx.get()
        if t_id:
            log_data["tenant_id"] = t_id

        u_id = user_id_ctx.get()
        if u_id:
            log_data["user_id"] = u_id

        # Extra attributes passed via extra={}
        if hasattr(record, "extra") and isinstance(record.extra, dict):
            for k, v in record.extra.items():
                if k not in log_data:
                    log_data[k] = sanitize_value(k, v)

        # Exceptions
        if record.exc_info:
            log_data["exception"] = "".join(traceback.format_exception(*record.exc_info))

        return json.dumps(log_data, default=str)


def setup_observability_logging(level: str = "INFO"):
    """Configures root logger with JSON log formatting to stdout."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLogFormatter())

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove default handlers to avoid duplicate unparsed log lines
    while root_logger.handlers:
        root_logger.handlers.pop()

    root_logger.addHandler(handler)

    # Keep uvicorn access/error loggers aligned
    for uvicorn_logger_name in ("uvicorn", "uvicorn.error"):
        l = logging.getLogger(uvicorn_logger_name)
        l.handlers = [handler]
        l.propagate = False
