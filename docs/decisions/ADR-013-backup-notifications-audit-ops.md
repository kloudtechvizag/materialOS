# ADR-013: Backup/recovery, notifications, audit, and platform operations as shared services

**Context:** the directive was explicit that this is not a per-module
feature -- "Do not implement these features separately inside each
module. Build them as shared platform services that every module can
use," and that it must work identically across every `IndustryProfile`
(ADR-010). All four pieces below are therefore generic: they know
nothing about "invoices" or "print jobs" specifically, only about
"tables" and "notification triggers a caller names."

## Backup & recovery (spec sec1-14)

**Tenant-scoped logical dump, never `pg_dump`.** Every tenant shares one
Postgres database under RLS (B9); a whole-database `pg_dump` would
either require superuser (bypassing RLS, dumping every tenant's data
into one file) or be meaningless run as the unprivileged app role. A
`Backup` instead means: for every RLS-registered table, `SELECT *` as
that tenant (RLS does the filtering for free), encrypt, checksum, store.
`_EXCLUDED_TABLES` (`audit_log`, `backups`, `idempotency_keys`) are
deliberately never dumped -- a backup of the backup catalog itself, or
of the audit trail of *taking* backups, is not useful data to restore.

**Restore ordering: topological sort over real FK edges, not a
hardcoded table list.** ~55 tenant-scoped tables exist and grow with
every new profile (Printing Press alone added three); hand-maintaining
a delete/insert order would silently rot. `_fk_edges()` reads
`pg_constraint` directly (see "Bugs found" below for why, not
`information_schema`), Kahn's algorithm produces a safe order, and
self-referential FKs (`PrintJob.rework_of_job_id`) are handled by
inserting with that column null and patching it once every row exists.

**`_RESTORE_STRUCTURAL_TABLES`** (`companies`, `branches`, `warehouses`,
`users`, `roles`, `role_permissions`, `user_roles`) are captured in every
dump for a complete historical record, but never deleted/re-inserted by
`restore_backup()`. Two reasons, not one: (1) `backups.company_id` holds
a live FK to `companies` that exists unconditionally at the DB level --
the current backup row is always present mid-restore, so deleting
`companies` is a hard FK violation, not a design choice; (2) it's also
the more correct semantic -- "restore my lost invoices/customers/stock"
should not imply "also delete and recreate my company/branch/warehouse/
user records," which a human never asked to lose.

**Encryption**: Fernet, `BACKUP_ENCRYPTION_KEY` from settings. A
deterministic (SHA256 of a fixed string), non-secret dev-only fallback
key lets the API process and the Celery worker -- separate containers,
no shared env var required in dev -- decrypt each other's backups.
Production refuses to run backups without a real key set, same
"refuse rather than silently do the unsafe thing" pattern as ADR-007's
e-invoice gateway.

**Deferred, and why**: point-in-time recovery (needs WAL archiving/a
managed Postgres feature, not application code); cross-region/off-site
replication (needs actual second infrastructure); a restore *dry-run*
diff view (real value, but sec10's core requirement -- a confirm-gated,
correctly-ordered restore -- had to exist first); backing up
`storage_data/` file attachments alongside DB rows (attachments are
already content-addressed on disk separately from the DB row referencing
them; folding them into the same encrypted JSON blob is a separate,
larger design question, not a one-line addition).

## Notifications (spec sec15-34, sec41-43)

**Real channel: email only**, via `smtplib` against `SMTP_HOST` etc. in
settings. WhatsApp/SMS/push are deferred outright -- they need paid
third-party provider credentials (Twilio/Gupshup/FCM) that don't exist
in this environment, and faking a "sent" status would be worse than
not offering the channel (same principle as ADR-007). `NotificationRule.
channels` is a JSONB list specifically so adding a real channel later is
a new function in `notification_channels.py` plus one dispatch branch,
not a schema change.

**Rule engine, not hardcoded triggers.** `NotificationRule` is a
per-tenant, per-trigger-type row (`stock_low`, `invoice_overdue`,
`credit_limit_exceeded`, `backup_failed` seeded by default at signup);
`fire_trigger()` is the one function every module calls (POS's stock
check is the first real caller) -- it looks up active matching rules
and respects `threshold_value` if set, so "do I notify" and "how loud"
are both administrator-configurable, not compiled in.

**Delivery + dead letters.** `NotificationDelivery` rows track each
channel attempt per notification; `deliver_notification_task` retries
up to `MAX_ATTEMPTS = 3` with backoff, then the delivery becomes a dead
letter, listed and manually retryable via `/notifications/dead-letters`.
This is deliberately not silent -- sec43's requirement that failed
deliveries are visible and recoverable, not just logged and forgotten.

**Deferred**: per-user notification preferences/quiet hours/digests (the
spec's own sec24-27) -- real scope, needs a preferences table and a
digest-batching job, orthogonal to getting the rule→delivery→dead-letter
pipeline correct first; in-app-only is today's default channel for all
four seeded rules specifically so no tenant gets surprise emails before
this exists.

## Audit (spec sec35-38)

No new capture code was needed: `audit_log` + the DB trigger populating
it (B12) has existed since Slice 0. This ADR's only work was exposing
what was already being captured: `GET /audit-logs` (filterable by table/
row/action/user/time) and `GET /audit-logs/tables`. RLS on `audit_log`
itself (already in `RLS_TABLES`) gives the same tenant-isolation
guarantee as every other read in the app, verified directly in
`test_audit_and_system_health.py::test_audit_log_is_tenant_isolated`.

**Deferred**: a data-export/download-history audit trail (sec38) --
no bulk-export feature exists yet in the app for it to log; retention/
archival policy for `audit_log` itself (unbounded growth is a real
future problem, not one this session's scope covers).

## System health & Command Center (spec sec39-40, sec50, sec61)

`GET /system-health` runs four *live* checks every call -- a real
`SELECT 1`, a real Redis `PING`, a real storage read/write round-trip,
and `celery_app.control.ping()` for the worker -- never a cached "all
green." `GET /command-center` is one aggregating read (health + 7-day
backup/notification stats + 24h audit count) so an administrator has
one screen instead of four, per the spec's explicit ask.

**Deferred**: an AI operations assistant (sec50 gestures at this) --
blocked on Slice 5 (the AI assistant), which per the existing README is
not started; this ADR does not invent a parallel AI feature to fill
that gap.

## Bugs found only by live verification against the running containers

Consistent with this project's standing practice (every prior slice was
verified against real running services, not just unit tests), two real
bugs surfaced only when the new endpoints were actually called end to
end after the migration was applied and the containers were live:

1. **`information_schema.constraint_column_usage` silently returns 0
   rows** under this app's unprivileged `materialos_app` DB role, even
   though the FK constraints genuinely exist (`information_schema.
   table_constraints` shows them). `_fk_edges()` originally used it and
   got 0 edges back with no error -- restore then deleted rows in
   arbitrary order and hit real `ForeignKeyViolation`s. Fixed by
   querying the `pg_constraint` system catalog directly
   (`conrelid`/`confrelid::regclass::text`, `contype = 'f'`), which is
   not privilege-filtered. Confirmed via a before/after debug script:
   0 edges -> 224 edges.
2. **`ACTIONS` in `services/permissions.py` didn't include `restore` or
   `manage`**, but `backup.restore` and `notification_rules.manage` are
   the actual permission codes the new endpoints check via
   `require_permission()`. Since `ensure_permission_catalog()` only ever
   generates `RESOURCES x ACTIONS`, those two specific codes were never
   inserted into the `permissions` table, so no role -- including a
   brand-new tenant's own `owner` role, which is granted *every row
   that exists in `permissions` at signup time* -- could ever hold them.
   A fresh signup's owner got a real `403 FORBIDDEN` calling
   `GET /notifications/rules`, caught only by actually calling the
   endpoint with a real token rather than trusting the schema/route
   code to be self-evidently correct. Fixed by adding `"restore"` and
   `"manage"` to the global `ACTIONS` list (matches the existing
   full-cross-product pattern -- a few now-unused codes like
   `companies.manage` exist too, same as `companies.approve` already
   did before this change).

Neither bug was caught by the unit test suite (mocked/isolated enough
to route around both), only by running actual HTTP requests against the
live Postgres-backed containers -- reaffirmed the value of that
verification step for this kind of cross-cutting, DB-introspection-heavy
work.

## Platform: new `beat` process

`celery_app.py` gained a `beat_schedule` (daily tenant backups at
02:00). Celery's scheduler is a separate long-running process, not a
worker flag -- `docker-compose.yml` gained a `beat` service
(`celery -A app.celery_app beat`). Also worth recording: Celery has no
hot-reload equivalent to uvicorn's `--reload` -- after `celery_app.py`
gained `include=[...]`, the already-running `worker` container kept
running its stale in-memory task registry (`KeyError` on the new task
names) until explicitly restarted; uvicorn's bind-mount reload does not
extend to the Celery process.
