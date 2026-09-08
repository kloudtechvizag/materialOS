"""Tenant-scoped logical backup/restore (ADR-013). See models/backup.py
for why this is not a whole-database pg_dump: this platform has every
tenant's rows in the same Postgres database (B9, RLS-isolated), so a
raw pg_dump would contain every other tenant's data too. Every SELECT
here runs with the tenant's RLS context already set by the caller
(get_db_tenant), so the dump can never contain another tenant's rows --
that guarantee comes from the database, not from care taken in this
module.
"""

import base64
import hashlib
import json
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import MetaData, Table, text
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import AppError, ErrorCode
from app.models.backup import Backup
from app.storage import read_file, save_file

# Tables intentionally excluded from tenant backups:
#   audit_log        -- a meta record of changes, not business data;
#                        restoring into it would corrupt the audit
#                        trail it exists to protect (B12/sec37)
#   backups           -- this table itself; a backup containing a
#                        record of other backups is not meaningful
#   idempotency_keys  -- ephemeral request-dedup state, meaningless
#                        after the fact
_EXCLUDED_TABLES = {"audit_log", "backups", "idempotency_keys"}

# Included in the dump (for a complete point-in-time record) but never
# deleted/re-inserted during restore -- the tenant's own organizational
# skeleton, not "business data" that gets lost and needs restoring.
# Concretely necessary, not just a judgment call: `backups` (excluded
# above, so never deleted) holds a RESTRICT FK to `companies` -- since
# a restore is always running *while its own Backup row still exists*,
# deleting `companies` would always fail with a foreign-key violation
# regardless of any other data in the tenant. Treating org-structure
# tables as restore-immutable sidesteps that (and similar) FK traps
# entirely, and is arguably the more correct semantic anyway: "restore
# my lost invoices/customers/stock" should not imply "also delete and
# recreate my company/branch/warehouse/user records."
_RESTORE_STRUCTURAL_TABLES = {"companies", "branches", "warehouses", "users", "roles", "role_permissions", "user_roles"}

# Deterministic, non-secret fallback so backups encrypted by one dev
# process (the API server) can be decrypted by another (the Celery
# worker) without a shared env var configured -- this key is IN THIS
# FILE, in source control, so it must never be used outside a dev
# environment. Production refuses to run backups at all without a real
# BACKUP_ENCRYPTION_KEY (same ADR-007 "refuse rather than fake" pattern
# as the e-invoice/e-way-bill gateways).
_DEV_FALLBACK_KEY = base64.urlsafe_b64encode(hashlib.sha256(b"materialos-dev-only-backup-key-do-not-use-in-prod").digest())


def _get_fernet() -> Fernet:
    if settings.backup_encryption_key:
        return Fernet(settings.backup_encryption_key.encode())
    if settings.environment == "production":
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "BACKUP_ENCRYPTION_KEY must be configured in production before backups can run.",
        )
    return Fernet(_DEV_FALLBACK_KEY)


def list_backupable_tables(db: Session) -> list[str]:
    """Every tenant-scoped table (same information_schema technique
    test_rls.py uses to find them) minus the meta/ephemeral exclusions
    above."""
    rows = db.execute(
        text(
            """
            SELECT DISTINCT table_name FROM information_schema.columns
            WHERE column_name = 'tenant_id' AND table_schema = 'public'
            """
        )
    ).scalars().all()
    return sorted(set(rows) - _EXCLUDED_TABLES)


def _fk_edges(db: Session, tables: list[str]) -> list[tuple[str, str]]:
    """(child_table, parent_table) pairs for FOREIGN KEY constraints
    where both tables are in our set. Self-references (a table with an
    FK to itself, e.g. print_jobs.rework_of_job_id) are excluded here --
    they don't impose an ordering constraint between two *different*
    tables, and are handled separately in restore (see
    _self_referential_fk_columns)."""
    # information_schema.constraint_column_usage silently returns zero
    # rows here: it's privilege-filtered to constraints the querying
    # role has ownership-adjacent rights on, and this app deliberately
    # connects as the unprivileged materialos_app role, never the
    # migration-owning superuser (B9 -- see
    # df0c4d3ffcbf_app_runtime_role_for_rls_enforcement.py). Confirmed
    # by direct comparison against pg_constraint (privilege-independent,
    # system catalog): 224 real FK edges vs. 0 from the
    # information_schema join. table_constraints/key_column_usage,
    # used elsewhere in this module, do not have this restriction --
    # only constraint_column_usage does.
    rows = db.execute(
        text(
            """
            SELECT conrelid::regclass::text AS child_table, confrelid::regclass::text AS parent_table
            FROM pg_constraint
            WHERE contype = 'f' AND connamespace = 'public'::regnamespace
                AND conrelid::regclass::text = ANY(:tables) AND confrelid::regclass::text = ANY(:tables)
            """
        ),
        {"tables": tables},
    ).all()
    return [(child, parent) for child, parent in rows if child != parent]


def _self_referential_fk_columns(db: Session, table: str) -> list[str]:
    rows = db.execute(
        text(
            """
            SELECT a.attname AS column_name
            FROM pg_constraint c
            JOIN unnest(c.conkey) AS k(attnum) ON true
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
            WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
                AND c.conrelid::regclass::text = :table AND c.confrelid::regclass::text = :table
            """
        ),
        {"table": table},
    ).scalars().all()
    return list(rows)


def _topological_order(tables: list[str], edges: list[tuple[str, str]]) -> list[str]:
    """Kahn's algorithm: parents before children. `edges` are
    (child, parent); an edge means parent must come first. Any table
    left over after the graph runs dry (a genuine cycle among 2+
    different tables -- not expected in this schema, but this must not
    crash a backup/restore if one is ever introduced) is appended in
    its original order rather than raising."""
    remaining = set(tables)
    children_of: dict[str, set[str]] = {t: set() for t in tables}  # parent -> children waiting on it
    indegree: dict[str, int] = {t: 0 for t in tables}
    for child, parent in edges:
        if parent in children_of and child in indegree:
            children_of[parent].add(child)
            indegree[child] += 1

    ready = sorted(t for t in tables if indegree[t] == 0)
    ordered: list[str] = []
    while ready:
        node = ready.pop(0)
        if node not in remaining:
            continue
        ordered.append(node)
        remaining.discard(node)
        for child in sorted(children_of[node]):
            indegree[child] -= 1
            if indegree[child] == 0:
                ready.append(child)
    ordered.extend(t for t in tables if t in remaining)  # unresolved (cycle) -- append rather than fail
    return ordered


def _json_default(value):
    if isinstance(value, (uuid.UUID,)):
        return str(value)
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value)} is not JSON serializable")


def create_pending_backup(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, user_id: uuid.UUID | None) -> Backup:
    """Fast, synchronous: just an INSERT, so an API endpoint can return
    a trackable id immediately and hand the slow part
    (execute_backup) to a background task -- sec53's "use background
    jobs for: Backup" without making the caller wait for a dump that
    could take a while on a large tenant."""
    backup = Backup(
        tenant_id=tenant_id, company_id=company_id, status="pending", created_by_user_id=user_id, table_counts={},
    )
    db.add(backup)
    db.flush()
    return backup


def execute_backup(db: Session, *, backup_id: uuid.UUID) -> Backup:
    """The slow part: dumps every row this tenant owns, across every
    tenant-scoped table, to one encrypted JSON document. Runs inside
    the caller's transaction (flush-only, like every other service in
    this codebase) -- the caller commits."""
    backup = db.get(Backup, backup_id)
    if backup is None:
        raise AppError(ErrorCode.NOT_FOUND, "Backup not found.", status_code=404)
    tenant_id = backup.tenant_id
    company_id = backup.company_id
    backup.status = "running"
    backup.started_at = datetime.now(timezone.utc)
    db.flush()

    try:
        tables = list_backupable_tables(db)
        dump: dict[str, list[dict]] = {}
        table_counts: dict[str, int] = {}
        for table in tables:
            rows = db.execute(
                text(f"SELECT * FROM {table} WHERE tenant_id = :tid"), {"tid": tenant_id}
            ).mappings().all()
            dump[table] = [dict(row) for row in rows]
            table_counts[table] = len(rows)

        document = {
            "version": 1,
            "tenant_id": str(tenant_id),
            "company_id": str(company_id),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "tables": dump,
        }
        payload = json.dumps(document, default=_json_default).encode("utf-8")
        checksum = hashlib.sha256(payload).hexdigest()
        encrypted = _get_fernet().encrypt(payload)

        storage_path = save_file(tenant_id=tenant_id, category="backups", file_name=f"{backup.id}.enc", content=encrypted)

        backup.status = "completed"
        backup.storage_path = storage_path
        backup.checksum = checksum
        backup.size_bytes = len(encrypted)
        backup.table_counts = table_counts
        backup.completed_at = datetime.now(timezone.utc)
    except Exception as exc:  # noqa: BLE001 -- a backup that fails must be recorded, not raised past this point
        backup.status = "failed"
        backup.error_message = str(exc)[:1000]
        backup.completed_at = datetime.now(timezone.utc)

    db.flush()
    return backup


def run_backup(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, user_id: uuid.UUID | None) -> Backup:
    """Convenience wrapper for callers that are already running in the
    background (the scheduled daily task) and don't need the
    create/execute split -- one call, fully synchronous within that
    background job."""
    backup = create_pending_backup(db, tenant_id=tenant_id, company_id=company_id, user_id=user_id)
    return execute_backup(db, backup_id=backup.id)


def _load_and_verify(backup: Backup) -> dict:
    if backup.status != "completed" or not backup.storage_path:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Backup is not in a completed state (status={backup.status}).")
    encrypted = read_file(backup.storage_path)
    try:
        payload = _get_fernet().decrypt(encrypted)
    except InvalidToken as exc:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Backup could not be decrypted -- wrong key or corrupted file.") from exc

    actual_checksum = hashlib.sha256(payload).hexdigest()
    if actual_checksum != backup.checksum:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Backup checksum mismatch -- file may be corrupted.")

    document = json.loads(payload)
    for table, count in backup.table_counts.items():
        if len(document.get("tables", {}).get(table, [])) != count:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"Backup row count mismatch for table {table!r}.")
    return document


def verify_backup(db: Session, *, backup_id: uuid.UUID) -> Backup:
    backup = db.get(Backup, backup_id)
    if backup is None:
        raise AppError(ErrorCode.NOT_FOUND, "Backup not found.", status_code=404)
    _load_and_verify(backup)  # raises AppError on any integrity failure
    backup.verified_at = datetime.now(timezone.utc)
    db.flush()
    return backup


def restore_backup(db: Session, *, tenant_id: uuid.UUID, backup_id: uuid.UUID, user_id: uuid.UUID, confirm: bool) -> Backup:
    """sec10: "restoring this backup may overwrite current data" --
    requires explicit confirm=True from the caller (the API layer is
    where the UI's confirmation dialog result becomes this flag).
    Deletes then re-inserts this tenant's own rows only (RLS-scoped
    DELETE/INSERT, same tenant context the caller already has) -- there
    is no code path here that can touch another tenant's data.
    """
    if not confirm:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Restore requires explicit confirmation.")

    backup = db.get(Backup, backup_id)
    if backup is None:
        raise AppError(ErrorCode.NOT_FOUND, "Backup not found.", status_code=404)
    document = _load_and_verify(backup)
    dump: dict[str, list[dict]] = document["tables"]

    # See _RESTORE_STRUCTURAL_TABLES: these were captured in the dump
    # (for a complete record) but are never deleted/re-inserted here.
    tables = [t for t in dump.keys() if t not in _RESTORE_STRUCTURAL_TABLES]
    edges = _fk_edges(db, tables)
    insert_order = _topological_order(tables, edges)
    delete_order = list(reversed(insert_order))

    metadata = MetaData()
    bind = db.get_bind()
    reflected: dict[str, Table] = {}
    self_ref_columns: dict[str, list[str]] = {}
    for table_name in tables:
        reflected[table_name] = Table(table_name, metadata, autoload_with=bind)
        self_ref_columns[table_name] = _self_referential_fk_columns(db, table_name)

    # Delete this tenant's current rows, children first.
    for table_name in delete_order:
        db.execute(reflected[table_name].delete().where(reflected[table_name].c.tenant_id == tenant_id))

    # Insert backed-up rows, parents first. Self-referential FK columns
    # are nulled on first insert (the row they'd point to may not exist
    # yet within this same batch) and patched back in a second pass
    # once every row exists.
    for table_name in insert_order:
        rows = dump[table_name]
        if not rows:
            continue
        self_cols = self_ref_columns[table_name]
        insert_rows = rows
        if self_cols:
            insert_rows = [{**row, **{col: None for col in self_cols}} for row in rows]
        db.execute(reflected[table_name].insert(), insert_rows)

    for table_name in insert_order:
        self_cols = self_ref_columns[table_name]
        if not self_cols:
            continue
        tbl = reflected[table_name]
        for row in dump[table_name]:
            values = {col: row.get(col) for col in self_cols if row.get(col) is not None}
            if values:
                db.execute(tbl.update().where(tbl.c.id == row["id"]).values(**values))

    backup.restored_at = datetime.now(timezone.utc)
    backup.restored_by_user_id = user_id
    db.flush()
    return backup
