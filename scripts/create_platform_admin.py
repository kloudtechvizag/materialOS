#!/usr/bin/env python3
"""Creates (or updates the password of) a platform admin -- MaterialOS-the-
company's own login for the platform console (ADR-020), never a tenant
user. Deliberately a manual script, not an API signup route: creating one
of these is a real operator action with cross-tenant reach, not a
self-service flow.

Run from the repo root with the API's venv active:
    DATABASE_URL=... python scripts/create_platform_admin.py \\
        --email you@materialos.example --name "Your Name" --password '...'
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "apps" / "api"))

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models.platform_admin import PlatformAdmin  # noqa: E402
from app.security import hash_password  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        admin = db.execute(select(PlatformAdmin).where(PlatformAdmin.email == args.email)).scalar_one_or_none()
        if admin is None:
            admin = PlatformAdmin(email=args.email, full_name=args.name, hashed_password=hash_password(args.password))
            db.add(admin)
            action = "Created"
        else:
            admin.full_name = args.name
            admin.hashed_password = hash_password(args.password)
            admin.is_active = True
            action = "Updated"
        db.commit()
        print(f"{action} platform admin: {args.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
