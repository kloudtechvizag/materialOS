"""people & payroll platform

Revision ID: e5b2f8c1a930
Revises: c7e1a49f0b6d
Create Date: 2026-09-08 14:00:00.000000

ADR-015. Org structure (departments, designations, shifts, holiday
calendars), the Employee master + its timeline, attendance (records +
correction requests), leave (types/balances/requests), and payroll
(salary components, versioned salary assignments, payroll runs, and
payroll items -- which double as payslips). All tenant-scoped,
RLS+audit like every other tenant table in this codebase.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'e5b2f8c1a930'
down_revision: Union[str, None] = 'c7e1a49f0b6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = [
    "departments", "designations", "shifts", "employees", "employee_history", "shift_assignments",
    "holiday_calendars", "holidays", "attendance_records", "attendance_corrections",
    "leave_types", "leave_balances", "leave_requests",
    "salary_components", "employee_salary_assignments", "payroll_runs", "payroll_items", "employee_advances",
]
AUDITED_TABLES = RLS_TABLES


def upgrade() -> None:
    op.create_table(
        'departments',
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('cost_center_id', sa.UUID(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['cost_center_id'], ['cost_centers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'company_id', 'name', name='uq_departments_company_name'),
    )
    op.create_index(op.f('ix_departments_company_id'), 'departments', ['company_id'], unique=False)
    op.create_index(op.f('ix_departments_tenant_id'), 'departments', ['tenant_id'], unique=False)

    op.create_table(
        'designations',
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'company_id', 'name', name='uq_designations_company_name'),
    )
    op.create_index(op.f('ix_designations_company_id'), 'designations', ['company_id'], unique=False)
    op.create_index(op.f('ix_designations_tenant_id'), 'designations', ['tenant_id'], unique=False)

    op.create_table(
        'shifts',
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('break_minutes', sa.Integer(), nullable=False),
        sa.Column('grace_minutes', sa.Integer(), nullable=False),
        sa.Column('is_night_shift', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_shifts_company_id'), 'shifts', ['company_id'], unique=False)
    op.create_index(op.f('ix_shifts_tenant_id'), 'shifts', ['tenant_id'], unique=False)

    op.create_table(
        'employees',
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('employee_code', sa.String(length=30), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('gender', sa.String(length=20), nullable=True),
        sa.Column('date_of_birth', sa.Date(), nullable=True),
        sa.Column('joining_date', sa.Date(), nullable=False),
        sa.Column('employment_type', sa.String(length=30), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('department_id', sa.UUID(), nullable=True),
        sa.Column('designation_id', sa.UUID(), nullable=True),
        sa.Column('reporting_manager_id', sa.UUID(), nullable=True),
        sa.Column('shift_id', sa.UUID(), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('emergency_contact_name', sa.String(length=200), nullable=True),
        sa.Column('emergency_contact_phone', sa.String(length=20), nullable=True),
        sa.Column('address_line1', sa.String(length=200), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=True),
        sa.Column('pincode', sa.String(length=10), nullable=True),
        sa.Column('bank_account_number', sa.String(length=40), nullable=True),
        sa.Column('bank_ifsc', sa.String(length=15), nullable=True),
        sa.Column('bank_name', sa.String(length=200), nullable=True),
        sa.Column('pan_number', sa.String(length=10), nullable=True),
        sa.Column('statutory_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['designation_id'], ['designations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reporting_manager_id'], ['employees.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'employee_code', name='uq_employees_code'),
    )
    for col in ['company_id', 'branch_id', 'user_id', 'department_id', 'designation_id', 'reporting_manager_id', 'shift_id', 'tenant_id']:
        op.create_index(op.f(f'ix_employees_{col}'), 'employees', [col], unique=False)

    op.create_table(
        'employee_history',
        sa.Column('employee_id', sa.UUID(), nullable=False),
        sa.Column('event_type', sa.String(length=30), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('old_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('new_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('created_by_user_id', sa.UUID(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_employee_history_employee_id'), 'employee_history', ['employee_id'], unique=False)
    op.create_index(op.f('ix_employee_history_tenant_id'), 'employee_history', ['tenant_id'], unique=False)

    op.create_table(
        'shift_assignments',
        sa.Column('employee_id', sa.UUID(), nullable=False),
        sa.Column('shift_id', sa.UUID(), nullable=False),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_shift_assignments_employee_id'), 'shift_assignments', ['employee_id'], unique=False)
    op.create_index(op.f('ix_shift_assignments_shift_id'), 'shift_assignments', ['shift_id'], unique=False)
    op.create_index(op.f('ix_shift_assignments_tenant_id'), 'shift_assignments', ['tenant_id'], unique=False)

    op.create_table(
        'holiday_calendars',
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_holiday_calendars_company_id'), 'holiday_calendars', ['company_id'], unique=False)
    op.create_index(op.f('ix_holiday_calendars_tenant_id'), 'holiday_calendars', ['tenant_id'], unique=False)

    op.create_table(
        'holidays',
        sa.Column('calendar_id', sa.UUID(), nullable=False),
        sa.Column('holiday_date', sa.Date(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['calendar_id'], ['holiday_calendars.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_holidays_calendar_id'), 'holidays', ['calendar_id'], unique=False)
    op.create_index(op.f('ix_holidays_tenant_id'), 'holidays', ['tenant_id'], unique=False)

    op.create_table(
        'attendance_records',
        sa.Column('employee_id', sa.UUID(), nullable=False),
        sa.Column('attendance_date', sa.Date(), nullable=False),
        sa.Column('clock_in_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('clock_out_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('method', sa.String(length=20), nullable=False),
        sa.Column('worked_minutes', sa.Integer(), nullable=False),
        sa.Column('late_minutes', sa.Integer(), nullable=False),
        sa.Column('overtime_minutes', sa.Integer(), nullable=False),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'employee_id', 'attendance_date', name='uq_attendance_employee_date'),
    )
    op.create_index(op.f('ix_attendance_records_employee_id'), 'attendance_records', ['employee_id'], unique=False)
    op.create_index(op.f('ix_attendance_records_tenant_id'), 'attendance_records', ['tenant_id'], unique=False)

    op.create_table(
        'attendance_corrections',
        sa.Column('employee_id', sa.UUID(), nullable=False),
        sa.Column('attendance_date', sa.Date(), nullable=False),
        sa.Column('requested_clock_in', sa.DateTime(timezone=True), nullable=True),
        sa.Column('requested_clock_out', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reason', sa.String(length=500), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('reviewed_by_user_id', sa.UUID(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_notes', sa.String(length=500), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_attendance_corrections_employee_id'), 'attendance_corrections', ['employee_id'], unique=False)
    op.create_index(op.f('ix_attendance_corrections_tenant_id'), 'attendance_corrections', ['tenant_id'], unique=False)

    op.create_table(
        'leave_types',
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('annual_allocation_days', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('allow_half_day', sa.Boolean(), nullable=False),
        sa.Column('is_paid', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'company_id', 'code', name='uq_leave_types_company_code'),
    )
    op.create_index(op.f('ix_leave_types_company_id'), 'leave_types', ['company_id'], unique=False)
    op.create_index(op.f('ix_leave_types_tenant_id'), 'leave_types', ['tenant_id'], unique=False)

    op.create_table(
        'leave_balances',
        sa.Column('employee_id', sa.UUID(), nullable=False),
        sa.Column('leave_type_id', sa.UUID(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('allocated_days', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('used_days', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('carried_forward_days', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['leave_type_id'], ['leave_types.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'employee_id', 'leave_type_id', 'year', name='uq_leave_balances_employee_type_year'),
    )
    op.create_index(op.f('ix_leave_balances_employee_id'), 'leave_balances', ['employee_id'], unique=False)
    op.create_index(op.f('ix_leave_balances_leave_type_id'), 'leave_balances', ['leave_type_id'], unique=False)
    op.create_index(op.f('ix_leave_balances_tenant_id'), 'leave_balances', ['tenant_id'], unique=False)

    op.create_table(
        'leave_requests',
        sa.Column('employee_id', sa.UUID(), nullable=False),
        sa.Column('leave_type_id', sa.UUID(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('days', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('half_day', sa.Boolean(), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('reviewed_by_user_id', sa.UUID(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_notes', sa.String(length=500), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['leave_type_id'], ['leave_types.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_leave_requests_employee_id'), 'leave_requests', ['employee_id'], unique=False)
    op.create_index(op.f('ix_leave_requests_leave_type_id'), 'leave_requests', ['leave_type_id'], unique=False)
    op.create_index(op.f('ix_leave_requests_tenant_id'), 'leave_requests', ['tenant_id'], unique=False)

    op.create_table(
        'salary_components',
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('component_type', sa.String(length=20), nullable=False),
        sa.Column('calculation_type', sa.String(length=20), nullable=False),
        sa.Column('percentage_basis', sa.String(length=20), nullable=True),
        sa.Column('default_amount', sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column('default_percentage', sa.Numeric(precision=6, scale=3), nullable=True),
        sa.Column('is_statutory', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'company_id', 'code', name='uq_salary_components_company_code'),
    )
    op.create_index(op.f('ix_salary_components_company_id'), 'salary_components', ['company_id'], unique=False)
    op.create_index(op.f('ix_salary_components_tenant_id'), 'salary_components', ['tenant_id'], unique=False)

    op.create_table(
        'employee_salary_assignments',
        sa.Column('employee_id', sa.UUID(), nullable=False),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('annual_ctc', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('monthly_gross', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('basic', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('component_overrides', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('overtime_hourly_rate', sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('reason', sa.String(length=300), nullable=True),
        sa.Column('approved_by_user_id', sa.UUID(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_employee_salary_assignments_employee_id'), 'employee_salary_assignments', ['employee_id'], unique=False)
    op.create_index(op.f('ix_employee_salary_assignments_tenant_id'), 'employee_salary_assignments', ['tenant_id'], unique=False)

    op.create_table(
        'payroll_runs',
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('period_label', sa.String(length=50), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('total_gross', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('total_deductions', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('total_net', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('total_employer_cost', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('calculated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_by_user_id', sa.UUID(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('locked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'company_id', 'period_start', 'period_end', name='uq_payroll_runs_period'),
    )
    op.create_index(op.f('ix_payroll_runs_company_id'), 'payroll_runs', ['company_id'], unique=False)
    op.create_index(op.f('ix_payroll_runs_tenant_id'), 'payroll_runs', ['tenant_id'], unique=False)

    op.create_table(
        'payroll_items',
        sa.Column('payroll_run_id', sa.UUID(), nullable=False),
        sa.Column('employee_id', sa.UUID(), nullable=False),
        sa.Column('working_days', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('present_days', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('leave_days', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('lop_days', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('overtime_hours', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('gross_earnings', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('total_deductions', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('net_pay', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('earnings_breakdown', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('deductions_breakdown', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('exceptions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['payroll_run_id'], ['payroll_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'payroll_run_id', 'employee_id', name='uq_payroll_items_run_employee'),
    )
    op.create_index(op.f('ix_payroll_items_payroll_run_id'), 'payroll_items', ['payroll_run_id'], unique=False)
    op.create_index(op.f('ix_payroll_items_employee_id'), 'payroll_items', ['employee_id'], unique=False)
    op.create_index(op.f('ix_payroll_items_tenant_id'), 'payroll_items', ['tenant_id'], unique=False)

    op.create_table(
        'employee_advances',
        sa.Column('employee_id', sa.UUID(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('reason', sa.String(length=300), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('monthly_deduction_amount', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('outstanding_amount', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('approved_by_user_id', sa.UUID(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_employee_advances_employee_id'), 'employee_advances', ['employee_id'], unique=False)
    op.create_index(op.f('ix_employee_advances_tenant_id'), 'employee_advances', ['tenant_id'], unique=False)

    for table in RLS_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
            WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
            """
        )

    for table in AUDITED_TABLES:
        op.execute(
            f"""
            CREATE TRIGGER audit_trg
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()
            """
        )


def downgrade() -> None:
    for table in AUDITED_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS audit_trg ON {table}")
    for table in RLS_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.drop_table('employee_advances')
    op.drop_table('payroll_items')
    op.drop_table('payroll_runs')
    op.drop_table('employee_salary_assignments')
    op.drop_table('salary_components')
    op.drop_table('leave_requests')
    op.drop_table('leave_balances')
    op.drop_table('leave_types')
    op.drop_table('attendance_corrections')
    op.drop_table('attendance_records')
    op.drop_table('holidays')
    op.drop_table('holiday_calendars')
    op.drop_table('shift_assignments')
    op.drop_table('employee_history')
    op.drop_table('employees')
    op.drop_table('shifts')
    op.drop_table('designations')
    op.drop_table('departments')
