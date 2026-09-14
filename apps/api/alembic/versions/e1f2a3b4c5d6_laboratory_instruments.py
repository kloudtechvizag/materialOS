"""laboratory instruments (CSV result import)

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-09-14 14:00:00.000000

Adds lab_instruments (a catalog entry for a physical instrument) and a
nullable instrument_id column on lab_results, recording which
instrument produced a result via CSV import versus manual entry (null).
Deliberately not a live ASTM/HL7 wire protocol -- see ADR-021's
instruments addendum. Standard per-tenant RLS + audit_trg on the new
table.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'lab_instruments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('manufacturer', sa.String(length=150), nullable=True),
        sa.Column('model', sa.String(length=150), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'company_id', 'code', name='uq_lab_instruments_company_code'),
    )
    op.execute("ALTER TABLE lab_instruments ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE lab_instruments FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON lab_instruments
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_trg
        AFTER INSERT OR UPDATE OR DELETE ON lab_instruments
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()
        """
    )

    op.add_column('lab_results', sa.Column('instrument_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_instruments.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_lab_results_instrument_id', 'lab_results', ['instrument_id'])


def downgrade() -> None:
    op.drop_index('ix_lab_results_instrument_id', table_name='lab_results')
    op.drop_column('lab_results', 'instrument_id')

    op.execute("DROP TRIGGER IF EXISTS audit_trg ON lab_instruments")
    op.drop_table('lab_instruments')
