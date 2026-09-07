from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def set_session_context(db: Session, *, tenant_id: str | None, user_id: str | None) -> None:
    """Set Postgres session-local GUCs consumed by RLS policies (B9) and the
    audit trigger (B12). Must run inside the same transaction as the queries
    it protects, hence SET LOCAL rather than SET.
    """
    # set_config(..., true) behaves like SET LOCAL but, unlike the SET
    # statement, accepts a bound parameter for the value.
    db.execute(text("SELECT set_config('app.current_tenant', :v, true)"), {"v": tenant_id or ""})
    db.execute(text("SELECT set_config('app.current_user', :v, true)"), {"v": user_id or ""})


def get_db() -> Generator[Session, None, None]:
    """Plain DB session with no tenant context set. RLS-protected tables
    return zero rows in this state by design (B9) -- use for platform-level
    operations (auth, tenant bootstrap) only.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """For use outside request scope (scripts, Celery tasks)."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
