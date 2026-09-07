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


settings = Settings()
