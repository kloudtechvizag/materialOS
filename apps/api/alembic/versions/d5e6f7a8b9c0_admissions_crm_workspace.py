"""admissions CRM workspace: assigned counsellor + real activity log

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-09-23 06:00:00.000000

ADR-045: AdmissionEnquiry.assigned_to_id reuses the core Employee
model (same pattern as Section.class_teacher_id). admission_enquiry_
activities is a real, small append-only log backing an honest
multi-entry activity timeline -- the pre-existing `notes` field stays
a single current-state field, not retrofitted into a fake history.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
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
    op.add_column('admission_enquiries', sa.Column('assigned_to_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_admission_enquiries_assigned_to_id', 'admission_enquiries', 'employees', ['assigned_to_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_admission_enquiries_assigned_to_id', 'admission_enquiries', ['assigned_to_id'])

    op.create_table(
        'admission_enquiry_activities',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('enquiry_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('admission_enquiries.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('activity_type', sa.String(length=30), nullable=False),
        sa.Column('description', sa.String(length=1000), nullable=False),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    _rls('admission_enquiry_activities')


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_trg ON admission_enquiry_activities")
    op.drop_table('admission_enquiry_activities')

    op.drop_index('ix_admission_enquiries_assigned_to_id', table_name='admission_enquiries')
    op.drop_constraint('fk_admission_enquiries_assigned_to_id', 'admission_enquiries', type_='foreignkey')
    op.drop_column('admission_enquiries', 'assigned_to_id')
