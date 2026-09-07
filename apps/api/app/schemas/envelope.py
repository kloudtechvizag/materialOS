from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PageMeta(BaseModel):
    next_cursor: str | None = None
    page_size: int


class Page(BaseModel, Generic[T]):
    """G7: every list endpoint is keyset-paginated, not OFFSET-paginated,
    so `meta` carries a next_cursor rather than a page number.
    """

    data: list[T]
    meta: PageMeta
