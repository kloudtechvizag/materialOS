from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    # Runtime connection: a non-superuser role, so RLS (B9) actually
    # applies -- Postgres superusers bypass RLS unconditionally, even
    # with FORCE ROW LEVEL SECURITY set.
    database_url: str = "postgresql+psycopg://materialos_app:materialos_app_dev_password@localhost:5432/materialos"
    # Migrations run as the superuser/owner role so DDL and role/grant
    # management work.
    migrations_database_url: str = "postgresql+psycopg://materialos:materialos@localhost:5432/materialos"
    app_db_password: str = "materialos_app_dev_password"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14
    idempotency_key_ttl_hours: int = 24

    # ADR-007: unset in every environment we actually run in. When these
    # are genuinely configured (a contracted GSP/ASP, real NIC access)
    # AND environment == "production", the live gateways activate;
    # otherwise every tenant gets the sandbox gateway.
    einvoice_gsp_base_url: str | None = None
    einvoice_gsp_client_id: str | None = None
    einvoice_gsp_client_secret: str | None = None
    ewaybill_nic_base_url: str | None = None
    ewaybill_nic_client_id: str | None = None
    ewaybill_nic_client_secret: str | None = None

    # ADR-013: unset in dev (services/backup.py falls back to a
    # deterministic, non-secret dev-only key); required in production,
    # where backups refuse to run without it rather than silently using
    # the dev key.
    backup_encryption_key: str | None = None
    # ADR-013: unset means the email channel honestly reports
    # "not configured" per delivery attempt rather than pretending to
    # send -- same reasoning as the WhatsApp gap (ADR-009) and the
    # e-invoice/e-way-bill gateways (ADR-007).
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_address: str | None = None


settings = Settings()
