from datetime import datetime

from pydantic import BaseModel


class SupportTicketCreate(BaseModel):
    subject: str
    body: str
    priority: str = "normal"


class SupportMessageCreate(BaseModel):
    body: str


class SupportMessageOut(BaseModel):
    id: str
    body: str
    author_user_id: str | None
    author_platform_admin_id: str | None
    created_at: datetime


class SupportTicketOut(BaseModel):
    id: str
    subject: str
    status: str
    priority: str
    created_at: datetime
    updated_at: datetime


class SupportTicketDetail(SupportTicketOut):
    messages: list[SupportMessageOut]


class SupportTicketStatusUpdate(BaseModel):
    status: str


# Platform-side: the same ticket shape, plus which tenant it belongs to
# -- meaningless on the tenant-facing endpoints (a tenant already knows
# it's looking at its own tickets), essential on the cross-tenant inbox.
class PlatformSupportTicketOut(SupportTicketOut):
    tenant_id: str
    tenant_name: str
    tenant_slug: str
