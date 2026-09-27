"""WAHA WhatsApp HTTP API and Omnichannel Communication domain

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-09-27 03:30:00.000000

Adds multi-tenant WAHA WhatsApp session configs, communication templates,
outbound communication message logs, and inbound message logs with RLS
isolation and audit triggers.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'f9a0b1c2d3e4'
down_revision: Union[str, None] = 'e8f9a0b1c2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = [
    'tenant_communication_configs',
    'communication_templates',
    'communication_messages',
    'inbound_communication_messages',
]


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
        'tenant_communication_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('waha_session_id', sa.String(length=100), nullable=False, server_default='default'),
        sa.Column('waha_endpoint_url', sa.String(length=500), nullable=True),
        sa.Column('waha_api_key', sa.String(length=500), nullable=True),
        sa.Column('session_status', sa.String(length=50), nullable=False, server_default='STOPPED'),
        sa.Column('phone_number', sa.String(length=50), nullable=True),
        sa.Column('push_name', sa.String(length=100), nullable=True),
        sa.Column('battery_level', sa.Integer(), nullable=True),
        sa.Column('is_plugged', sa.Boolean(), nullable=True),
        sa.Column('qr_code_raw', sa.Text(), nullable=True),
        sa.Column('auto_reject_calls', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('auto_reject_message', sa.String(length=500), nullable=False, server_default='Thank you for contacting us. We do not accept voice calls on this automated WhatsApp desk. Please message us here.'),
        sa.Column('mcp_copilot_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sms_provider', sa.String(length=50), nullable=True),
        sa.Column('sms_credentials', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('enabled_channels', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='["whatsapp"]'),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', name='uq_tenant_communication_config'),
    )

    op.create_table(
        'communication_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('slug', sa.String(length=100), nullable=False, index=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False, server_default='general'),
        sa.Column('whatsapp_body', sa.Text(), nullable=False),
        sa.Column('sms_body', sa.Text(), nullable=True),
        sa.Column('dlt_template_id', sa.String(length=100), nullable=True),
        sa.Column('sample_variables', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'slug', name='uq_communication_template_slug'),
    )

    op.create_table(
        'communication_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('entity_type', sa.String(length=50), nullable=True),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('recipient_name', sa.String(length=200), nullable=True),
        sa.Column('recipient_phone', sa.String(length=50), nullable=False, index=True),
        sa.Column('channel', sa.String(length=20), nullable=False, server_default='whatsapp'),
        sa.Column('template_slug', sa.String(length=100), nullable=True),
        sa.Column('rendered_text', sa.Text(), nullable=False),
        sa.Column('media_url', sa.String(length=500), nullable=True),
        sa.Column('media_filename', sa.String(length=200), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('provider_message_id', sa.String(length=200), nullable=True, index=True),
        sa.Column('provider_response', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'inbound_communication_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('sender_phone', sa.String(length=50), nullable=False, index=True),
        sa.Column('sender_name', sa.String(length=200), nullable=True),
        sa.Column('channel', sa.String(length=20), nullable=False, server_default='whatsapp'),
        sa.Column('message_id', sa.String(length=200), nullable=True, index=True),
        sa.Column('message_text', sa.Text(), nullable=True),
        sa.Column('media_url', sa.String(length=500), nullable=True),
        sa.Column('raw_payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('processed_by_copilot', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('copilot_reply', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    for table in TABLES:
        _rls(table)


def downgrade() -> None:
    for table in reversed(TABLES):
        op.execute(f"DROP TRIGGER IF EXISTS audit_trg ON {table}")
        op.drop_table(table)
