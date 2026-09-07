"""Object storage adapter. Local filesystem for dev; the interface is
narrow enough to swap in an S3/MinIO-backed implementation later without
touching callers (Part E: "S3-compatible object storage").
"""

import uuid
from pathlib import Path

STORAGE_ROOT = Path(__file__).resolve().parent.parent / "storage_data"


def save_file(*, tenant_id: uuid.UUID, category: str, file_name: str, content: bytes) -> str:
    directory = STORAGE_ROOT / str(tenant_id) / category
    directory.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}_{file_name}"
    path = directory / safe_name
    path.write_bytes(content)
    return str(path.relative_to(STORAGE_ROOT))


def read_file(relative_path: str) -> bytes:
    return (STORAGE_ROOT / relative_path).read_bytes()
