import uuid

from pydantic import BaseModel


class SearchResultItem(BaseModel):
    id: uuid.UUID
    title: str
    subtitle: str | None = None
    href: str


class SearchResults(BaseModel):
    leads: list[SearchResultItem] = []
    customers: list[SearchResultItem] = []
    suppliers: list[SearchResultItem] = []
    items: list[SearchResultItem] = []
    quotations: list[SearchResultItem] = []
    sales_orders: list[SearchResultItem] = []
    invoices: list[SearchResultItem] = []
    purchase_orders: list[SearchResultItem] = []
