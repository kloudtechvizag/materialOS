"""laboratory worksheets (batch testing)

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-09-14 12:00:00.000000

Adds lab_worksheets (a batch of test orders for one test definition,
run together by one analyst -- spec sec15) plus a nullable worksheet_id
opt-in column on lab_test_orders and on qc_runs, so a worksheet's own
QC runs can gate authorization for exactly that worksheet's batch of
results instead of the coarser test-definition-wide fallback (see
ADR-021's worksheets addendum). Standard per-tenant RLS + audit_trg on
the new table.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'd0e1f2a3b4c5'
down_revision: Union[str, None] = 'c9d0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'lab_worksheets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('worksheet_number', sa.String(length=40), nullable=False, index=True),
        sa.Column('test_definition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_test_definitions.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
        sa.Column('analyst_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'worksheet_number', name='uq_lab_worksheets_tenant_number'),
    )
    op.execute("ALTER TABLE lab_worksheets ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE lab_worksheets FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON lab_worksheets
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_trg
        AFTER INSERT OR UPDATE OR DELETE ON lab_worksheets
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()
        """
    )

    op.add_column('lab_test_orders', sa.Column('worksheet_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_worksheets.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_lab_test_orders_worksheet_id', 'lab_test_orders', ['worksheet_id'])

    op.add_column('qc_runs', sa.Column('worksheet_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_worksheets.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_qc_runs_worksheet_id', 'qc_runs', ['worksheet_id'])


def downgrade() -> None:
    op.drop_index('ix_qc_runs_worksheet_id', table_name='qc_runs')
    op.drop_column('qc_runs', 'worksheet_id')

    op.drop_index('ix_lab_test_orders_worksheet_id', table_name='lab_test_orders')
    op.drop_column('lab_test_orders', 'worksheet_id')

    op.execute("DROP TRIGGER IF EXISTS audit_trg ON lab_worksheets")
    op.drop_table('lab_worksheets')
