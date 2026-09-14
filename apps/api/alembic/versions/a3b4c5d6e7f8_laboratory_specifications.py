"""laboratory specifications

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-09-14 18:00:00.000000

Adds lab_specifications -- a pass/fail criterion for one test,
optionally scoped to a specific client and/or sample type, layered on
top of (not replacing) lab_test_definitions' own flat reference_range/
critical columns. Adds specification_id/specification_result to
lab_results, both nullable -- no specification configured means no
verdict, never a fabricated one. See ADR-021's specifications
addendum. Standard per-tenant RLS + audit_trg on the new table.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'lab_specifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('test_definition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_test_definitions.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('sample_type_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_sample_types.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('criteria_type', sa.String(length=10), nullable=False, server_default='range'),
        sa.Column('min_value', sa.Numeric(18, 4), nullable=True),
        sa.Column('max_value', sa.Numeric(18, 4), nullable=True),
        sa.Column('target_value', sa.Numeric(18, 4), nullable=True),
        sa.Column('tolerance', sa.Numeric(18, 4), nullable=True),
        sa.Column('text_value', sa.String(length=200), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.execute("ALTER TABLE lab_specifications ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE lab_specifications FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON lab_specifications
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_trg
        AFTER INSERT OR UPDATE OR DELETE ON lab_specifications
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()
        """
    )

    op.add_column('lab_results', sa.Column('specification_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lab_specifications.id', ondelete='SET NULL'), nullable=True))
    op.add_column('lab_results', sa.Column('specification_result', sa.String(length=10), nullable=True))
    op.create_index('ix_lab_results_specification_id', 'lab_results', ['specification_id'])


def downgrade() -> None:
    op.drop_index('ix_lab_results_specification_id', table_name='lab_results')
    op.drop_column('lab_results', 'specification_result')
    op.drop_column('lab_results', 'specification_id')

    op.execute("DROP TRIGGER IF EXISTS audit_trg ON lab_specifications")
    op.drop_table('lab_specifications')
