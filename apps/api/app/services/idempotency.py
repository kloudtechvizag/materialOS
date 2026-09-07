"""B8: every write endpoint is idempotent. Client supplies an
Idempotency-Key header; the server stores the key + response for
`idempotency_key_ttl_hours` and replays it verbatim on retry instead of
re-running the mutation -- the alternative is duplicate invoices when a
field app on a flaky connection retries a POST it never got a response for.
"""

import hashlib
import json
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import AppError, ErrorCode
from app.models.idempotency import IdempotencyKey


def hash_request_body(body: dict[str, Any]) -> str:
    canonical = json.dumps(body, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


def run_idempotent(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    idempotency_key: str | None,
    request_path: str,
    request_body: dict[str, Any],
    compute: Callable[[], tuple[int, dict[str, Any]]],
) -> tuple[int, dict[str, Any]]:
    if not idempotency_key:
        return compute()

    request_hash = hash_request_body(request_body)
    existing = db.execute(
        select(IdempotencyKey).where(
            IdempotencyKey.tenant_id == tenant_id, IdempotencyKey.key == idempotency_key
        )
    ).scalar_one_or_none()

    if existing is not None:
        if existing.request_hash != request_hash:
            raise AppError(
                ErrorCode.IDEMPOTENCY_KEY_CONFLICT,
                "This Idempotency-Key was already used with a different request body.",
                status_code=409,
            )
        return existing.response_status, existing.response_body

    status_code, response_body = compute()

    db.add(
        IdempotencyKey(
            tenant_id=tenant_id,
            key=idempotency_key,
            request_path=request_path,
            request_hash=request_hash,
            response_status=status_code,
            response_body=response_body,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.idempotency_key_ttl_hours),
        )
    )
    db.flush()
    return status_code, response_body
