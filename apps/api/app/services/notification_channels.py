"""sec19: one small interface, real in-app delivery (it's just a DB
row -- see services/notifications.py), and an honest email
implementation that reports "not configured" per attempt rather than
faking success -- same ADR-007/009 reasoning as every other
provider-dependent feature in this codebase. SMS/WhatsApp/push are not
implemented at all (not stubbed-and-lying, just absent) -- no provider
credentials exist in any environment this runs in; see ADR-013.
"""

import smtplib
from email.message import EmailMessage

from app.config import settings


class ChannelResult:
    def __init__(self, ok: bool, detail: str) -> None:
        self.ok = ok
        self.detail = detail


def send_email(*, to_address: str, subject: str, body: str) -> ChannelResult:
    if not settings.smtp_host or not settings.smtp_from_address:
        return ChannelResult(ok=False, detail="SMTP not configured (SMTP_HOST/SMTP_FROM_ADDRESS unset).")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_address
    message["To"] = to_address
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
            client.starttls()
            if settings.smtp_username and settings.smtp_password:
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)
        return ChannelResult(ok=True, detail="Sent.")
    except Exception as exc:  # noqa: BLE001 -- a delivery failure must be recorded, not raised into the caller
        return ChannelResult(ok=False, detail=str(exc)[:500])


CHANNEL_STATUS: dict[str, str] = {
    "in_app": "available",
    "email": "available" if settings.smtp_host else "not_configured",
    "sms": "not_implemented",
    "whatsapp": "not_implemented",
    "push": "not_implemented",
}
