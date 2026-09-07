# MaterialOS

AI-powered building materials business operating system. See
[`MaterialOS_Master_Brief_v2.md`](MaterialOS_Master_Brief_v2.md) for the
product brief this build follows (it supersedes `dev.md`, the original
116-section v1 prompt, which is kept as the full feature backlog).

**Status:** Slice 0 (Foundation + Tally/Busy migration) is built and
working end to end -- signup, auth, RBAC, tenancy with real
database-enforced row-level security, document numbering, the audit
trigger, and the six-step Tally/Busy import pipeline. Slices 1-6 (sell &
stock, dispatch, procurement, accounting/GST, AI, customer portal) are
not started; see the brief's Part F for what's next and why the order
matters.

## Architecture

```
apps/
  api/    FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL 16, RLS-isolated per tenant
  web/    React + TypeScript (strict) + Vite + Tailwind + TanStack Query + Zustand
docs/
  decisions/   ADRs -- read these before changing a locked decision
scripts/
  seed.py      Slice-0-scoped demo data (Sri Balaji Building Materials)
```

Money is `NUMERIC(18,4)` + Python `Decimal` end to end, never a float.
Tenant isolation is enforced by PostgreSQL row-level security, not by
application code -- see `docs/decisions` and Part B of the brief for the
full list of non-negotiable invariants and why each one is a database
constraint, not a convention.

## Running it

Requires Docker. Ports are non-standard to avoid clashing with other
projects on the same machine: API on `58000`, web on `5173`, Postgres on
`55432`, Redis on `56379`.

```bash
docker-compose -p materialos up -d db redis
docker-compose -p materialos up -d api worker web
```

Then either sign up a fresh workspace at http://localhost:5173/signup,
or load the demo tenant:

```bash
cd apps/api
DATABASE_URL="postgresql+psycopg://materialos_app:materialos_app_dev_password@localhost:55432/materialos" \
  python ../../scripts/seed.py
```

Demo login: `owner@sribalaji-demo.example.com` / `demo-password-123`
(workspace: `sribalaji-demo`).

API docs: http://localhost:58000/docs

## Database migrations

Migrations run as the Postgres **superuser** role (`materialos`); the
API itself connects as a separate, unprivileged `materialos_app` role so
that row-level security actually applies -- Postgres superusers bypass
RLS unconditionally. See
`apps/api/alembic/versions/df0c4d3ffcbf_app_runtime_role_for_rls_enforcement.py`.

```bash
cd apps/api
MIGRATIONS_DATABASE_URL="postgresql+psycopg://materialos:materialos@localhost:55432/materialos" \
  alembic upgrade head
```

## Tests

```bash
cd apps/api
python -m venv .venv && .venv/bin/pip install -r requirements.txt
DATABASE_URL="postgresql+psycopg://materialos_app:materialos_app_dev_password@localhost:55432/materialos" \
  .venv/bin/python -m pytest -q
```

Tests run against a real Postgres instance, not mocks or SQLite --
several of the invariants in Part B (row-level security, concurrent
document numbering, gapless numbering under contention) are only real
under a real database engine.

## Decisions already made

Recorded in `docs/decisions/`:

- **ADR-001**: MaterialOS and nirmaanOS are separate products sharing
  nothing, for now (Option A from the brief's §A5).
- **ADR-002**: Slice 0 opening balances/stock use a minimal signed field
  and a real-but-minimal stock ledger, not the full journal/batch/bin
  machinery that belongs to Slices 1 and 4.

Read these before re-litigating either choice.
