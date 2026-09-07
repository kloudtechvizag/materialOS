"""app runtime role for RLS enforcement

Revision ID: df0c4d3ffcbf
Revises: 931a83f6aac5
Create Date: 2026-09-07 08:10:00.000000

B9 is only real if the connection running queries is not a Postgres
superuser -- superusers bypass row-level security unconditionally, even
with FORCE ROW LEVEL SECURITY. The migration role (settings.migrations_database_url)
stays a superuser/owner so DDL keeps working; the application connects as
this new, unprivileged role instead (settings.database_url).
"""
from typing import Sequence, Union

from alembic import op

from app.config import settings

revision: str = 'df0c4d3ffcbf'
down_revision: Union[str, None] = '931a83f6aac5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

APP_ROLE = "materialos_app"


def upgrade() -> None:
    password = settings.app_db_password.replace("'", "''")

    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '{APP_ROLE}') THEN
                CREATE ROLE {APP_ROLE} LOGIN PASSWORD '{password}';
            ELSE
                ALTER ROLE {APP_ROLE} LOGIN PASSWORD '{password}';
            END IF;
        END
        $$;
        """
    )
    op.execute(f"GRANT CONNECT ON DATABASE materialos TO {APP_ROLE}")
    op.execute(f"GRANT USAGE ON SCHEMA public TO {APP_ROLE}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {APP_ROLE}")
    op.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {APP_ROLE}")
    op.execute(
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {APP_ROLE}"
    )
    op.execute(
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO {APP_ROLE}"
    )


def downgrade() -> None:
    op.execute(f"REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM {APP_ROLE}")
    op.execute(f"REVOKE USAGE ON SCHEMA public FROM {APP_ROLE}")
    op.execute(f"REVOKE CONNECT ON DATABASE materialos FROM {APP_ROLE}")
    op.execute(f"DROP ROLE IF EXISTS {APP_ROLE}")
