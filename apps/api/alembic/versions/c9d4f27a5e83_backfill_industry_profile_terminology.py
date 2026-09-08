"""backfill industry profile terminology

Revision ID: c9d4f27a5e83
Revises: f1c8e34b7a02
Create Date: 2026-09-08 17:00:00.000000

ADR-010's second addendum. terminology has existed as a column since
industry_profile_engine (892b9921b956) but every profile was seeded
with {} -- unused, "left {} rather than shipping labels nothing
renders" per that migration's own comment. It's real now (item_label/
items_label relabel the Items nav entry and page header; the
*_example keys replace the Items/Customers/Suppliers "new record" form
placeholders), so this backfills real values onto every already-seeded
IndustryProfile row. ensure_industry_profile_catalog() only ever
INSERTs a missing slug, never UPDATEs an existing one (by design --
so a future admin override via the Industry Configuration settings
page isn't silently clobbered on every app restart), so a row seeded
before this change needs an explicit one-time UPDATE, the same
reasoning as every other catalog backfill this project has needed.

Reported live: a tenant on the printing_press profile saw
"UltraTech OPC53 50KG" (a cement bag) as the Items form's placeholder
-- the frontend was already calling useIndustryProfile() correctly,
it just had no real terminology to read.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'c9d4f27a5e83'
down_revision: Union[str, None] = 'f1c8e34b7a02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TERMINOLOGY = {
    "building_materials": {"item_label": "Item", "items_label": "Items", "item_name_example": "UltraTech OPC53 Cement 50KG", "item_uom_example": "BAG", "customer_name_example": "Sri Balaji Constructions", "supplier_name_example": "UltraTech Cement Distributors"},
    "retail": {"item_label": "Product", "items_label": "Products", "item_name_example": "Nivea Body Lotion 200ml", "item_uom_example": "PCS", "customer_name_example": "Walk-in Customer", "supplier_name_example": "FastMoving Consumer Distributors"},
    "pharmacy": {"item_label": "Medicine", "items_label": "Medicines", "item_name_example": "Paracetamol 500mg Strip", "item_uom_example": "STRIP", "customer_name_example": "Walk-in Patient", "supplier_name_example": "MedPlus Pharma Distributors"},
    "ecommerce": {"item_label": "Product", "items_label": "Products", "item_name_example": "Wireless Bluetooth Earbuds", "item_uom_example": "PCS", "customer_name_example": "Online Customer", "supplier_name_example": "Global Import Trading Co"},
    "fmcg": {"item_label": "SKU", "items_label": "SKUs", "item_name_example": "Parle-G Biscuit 200g Pack", "item_uom_example": "CTN", "customer_name_example": "City Retail Store", "supplier_name_example": "HUL Regional Distributors"},
    "auto_parts": {"item_label": "Part", "items_label": "Parts", "item_name_example": "Bosch Brake Pad Set - Swift", "item_uom_example": "SET", "customer_name_example": "City Garage Works", "supplier_name_example": "Bosch Auto Parts Distributors"},
    "food_beverage": {"item_label": "Menu Item", "items_label": "Menu Items", "item_name_example": "Masala Chai 200ml", "item_uom_example": "CUP", "customer_name_example": "Dine-in Customer", "supplier_name_example": "Fresh Farm Suppliers"},
    "chemical": {"item_label": "Chemical", "items_label": "Chemicals", "item_name_example": "Sodium Hydroxide 25kg Drum", "item_uom_example": "DRUM", "customer_name_example": "ABC Textile Processors", "supplier_name_example": "Deepak Chemicals Distributors"},
    "computer_hardware": {"item_label": "Product", "items_label": "Products", "item_name_example": "Logitech Wireless Mouse M235", "item_uom_example": "PCS", "customer_name_example": "Sri Computers Retail", "supplier_name_example": "Rashi Peripherals Distributors"},
    "furniture": {"item_label": "Item", "items_label": "Items", "item_name_example": "Sheesham Wood Dining Table 6-Seater", "item_uom_example": "PCS", "customer_name_example": "Interior Decor Studio", "supplier_name_example": "Jodhpur Wood Craft Suppliers"},
    "book_publishing": {"item_label": "Title", "items_label": "Titles", "item_name_example": "NCERT Mathematics Class 10", "item_uom_example": "PCS", "customer_name_example": "City Book Depot", "supplier_name_example": "National Book Trust Distributors"},
    "travel": {"item_label": "Package", "items_label": "Packages", "item_name_example": "Goa 4N/5D Family Package", "item_uom_example": "PKG", "customer_name_example": "Individual Traveller", "supplier_name_example": "Local Transport & Hotel Vendor"},
    "electrical": {"item_label": "Item", "items_label": "Items", "item_name_example": "Havells MCB 32A Single Pole", "item_uom_example": "PCS", "customer_name_example": "Local Electrical Contractor", "supplier_name_example": "Havells Regional Distributors"},
    "paper_mill": {"item_label": "Product", "items_label": "Products", "item_name_example": "80 GSM Copier Paper Reel", "item_uom_example": "MT", "customer_name_example": "Print & Packaging Buyer", "supplier_name_example": "Pulp & Waste Paper Suppliers"},
    "paint": {"item_label": "Product", "items_label": "Products", "item_name_example": "Asian Paints Tractor Emulsion 20L", "item_uom_example": "LTR", "customer_name_example": "Local Paint Contractor", "supplier_name_example": "Asian Paints Regional Distributors"},
    "mobile": {"item_label": "Product", "items_label": "Products", "item_name_example": "Samsung Galaxy M14 128GB", "item_uom_example": "PCS", "customer_name_example": "Walk-in Customer", "supplier_name_example": "Samsung Authorized Distributors"},
    "garments": {"item_label": "Style", "items_label": "Styles", "item_name_example": "Men's Cotton Formal Shirt - White", "item_uom_example": "PCS", "customer_name_example": "Retail Boutique Buyer", "supplier_name_example": "Tirupur Garment Manufacturers"},
    "jewellery": {"item_label": "Item", "items_label": "Items", "item_name_example": "22K Gold Necklace Set - 25g", "item_uom_example": "PCS", "customer_name_example": "Wedding Customer", "supplier_name_example": "Local Karigar Workshop"},
    "agriculture": {"item_label": "Input", "items_label": "Inputs", "item_name_example": "Urea Fertilizer 50kg Bag", "item_uom_example": "BAG", "customer_name_example": "Local Farmer", "supplier_name_example": "IFFCO Regional Distributors"},
    "stationery": {"item_label": "Item", "items_label": "Items", "item_name_example": "Classmate Notebook 172pg Single Line", "item_uom_example": "PCS", "customer_name_example": "School Supplies Buyer", "supplier_name_example": "ITC Stationery Distributors"},
    "electronics": {"item_label": "Product", "items_label": "Products", "item_name_example": "LG 1.5 Ton Split AC", "item_uom_example": "PCS", "customer_name_example": "Walk-in Customer", "supplier_name_example": "LG Electronics Regional Distributors"},
    "real_estate": {"item_label": "Unit", "items_label": "Units", "item_name_example": "2BHK Flat - Tower A, Floor 5", "item_uom_example": "UNIT", "customer_name_example": "Prospective Buyer", "supplier_name_example": "Building Material Contractor"},
    "grocery": {"item_label": "Product", "items_label": "Products", "item_name_example": "Tata Salt 1kg Pack", "item_uom_example": "PCS", "customer_name_example": "Walk-in Customer", "supplier_name_example": "Local Kirana Wholesale Distributor"},
    "printing_press": {"item_label": "Material", "items_label": "Materials", "item_name_example": "A4 80GSM Paper Ream", "item_uom_example": "REAM", "customer_name_example": "ABC Corporate Pvt Ltd", "supplier_name_example": "JK Paper Distributors"},
}


def upgrade() -> None:
    industry_profiles = sa.table(
        'industry_profiles',
        sa.column('slug', sa.String()),
        sa.column('terminology', postgresql.JSONB()),
    )
    conn = op.get_bind()
    for slug, terminology in TERMINOLOGY.items():
        conn.execute(
            industry_profiles.update().where(industry_profiles.c.slug == slug).values(terminology=terminology)
        )


def downgrade() -> None:
    industry_profiles = sa.table(
        'industry_profiles',
        sa.column('slug', sa.String()),
        sa.column('terminology', postgresql.JSONB()),
    )
    conn = op.get_bind()
    for slug in TERMINOLOGY:
        conn.execute(
            industry_profiles.update().where(industry_profiles.c.slug == slug).values(terminology={})
        )
