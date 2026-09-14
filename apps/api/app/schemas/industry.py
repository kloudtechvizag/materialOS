import uuid

from pydantic import BaseModel


class IndustryProfileOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    category: str
    terminology: dict
    enabled_modules: list[str]
    navigation_config: list
    dashboard_widgets: list[str]
    inventory_flags: dict
    pricing_strategy: str
    golden_workflow: dict

    class Config:
        from_attributes = True
