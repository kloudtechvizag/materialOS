"""education file attachments: AdmissionDocument table, Homework/
Announcement attachment columns

Revision ID: a2b3c4d5e6f7
Revises: f1c2d3e4b5a6
Create Date: 2026-09-22 12:00:00.000000

ADR-041: reuses app.storage's save_file/read_file convention already
established by Item.image_path (ADR-019) -- no new storage mechanism.
admission_documents is a real one-to-many table (an application needs
more than one document at once); homework/announcements each get a
single nullable attachment_path column, same shape as Item.image_path.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = 'f1c2d3e4b5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER audit_trg
        AFTER INSERT OR UPDATE OR DELETE ON {table}
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()
        """
    )


def upgrade() -> None:
    op.create_table(
        'admission_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('admission_applications.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('document_type', sa.String(length=100), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    _rls('admission_documents')

    op.add_column('homework', sa.Column('attachment_path', sa.String(length=500), nullable=True))
    op.add_column('homework', sa.Column('attachment_file_name', sa.String(length=255), nullable=True))
    op.add_column('announcements', sa.Column('attachment_path', sa.String(length=500), nullable=True))
    op.add_column('announcements', sa.Column('attachment_file_name', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('announcements', 'attachment_file_name')
    op.drop_column('announcements', 'attachment_path')
    op.drop_column('homework', 'attachment_file_name')
    op.drop_column('homework', 'attachment_path')

    op.execute("DROP TRIGGER IF EXISTS audit_trg ON admission_documents")
    op.drop_table('admission_documents')
