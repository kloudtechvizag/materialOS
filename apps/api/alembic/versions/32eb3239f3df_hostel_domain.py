"""hostel domain

Revision ID: 32eb3239f3df
Revises: eb22dcc13664
Create Date: 2026-10-02 06:00:00.000000

Hostel (spec sec19): hostel buildings (reusing the existing core
Employee model for warden_id), rooms, and per-year bed allocation.
Standard per-tenant RLS + audit_trg on all three tables.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '32eb3239f3df'
down_revision: Union[str, None] = 'eb22dcc13664'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ['hostels', 'hostel_rooms', 'student_hostel_allocations']


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
        'hostels',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('hostel_type', sa.String(length=20), nullable=False, server_default='co_ed'),
        sa.Column('warden_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'hostel_rooms',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('hostel_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hostels.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('room_number', sa.String(length=20), nullable=False),
        sa.Column('floor', sa.String(length=20), nullable=True),
        sa.Column('capacity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'hostel_id', 'room_number', name='uq_hostel_rooms_number'),
    )

    op.create_table(
        'student_hostel_allocations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('academic_year_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('academic_years.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('room_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hostel_rooms.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('bed_number', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'student_id', 'academic_year_id', name='uq_student_hostel_year'),
        sa.UniqueConstraint('tenant_id', 'room_id', 'bed_number', 'academic_year_id', name='uq_hostel_bed_year'),
    )

    for table in TABLES:
        _rls(table)


def downgrade() -> None:
    for table in reversed(TABLES):
        op.execute(f"DROP TRIGGER IF EXISTS audit_trg ON {table}")
        op.drop_table(table)
