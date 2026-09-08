"""Platform-global industry profile catalog (IndustryProfile is not
tenant-scoped -- see models/industry.py). Seeded once at startup exactly
like the permission catalog (services/permissions.py): a new industry is
a new entry in PROFILE_DEFINITIONS, not a migration or an `if industry ==`
branch anywhere in the app. The `building_materials` row is the one
exception with a matching migration, because it also needs to backfill
every pre-existing Company -- Retail/Pharmacy/future profiles need no
backfill (no company references them yet) and can ship purely as a new
list entry here.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.industry import IndustryProfile

# Reused across the profiles below purely to keep 20+ near-identical
# dicts readable -- not a schema, just literal defaults. inventory_flags
# is a free-form JSONB dict (see models/industry.py); any key can be
# added per profile (e.g. serial_tracking for IMEI-driven ones) without
# a migration or a frontend change -- IndustryConfigPage already renders
# whatever keys are present generically.
DEALER_WIDGETS = ["outstanding", "invoiced", "open_sales_orders", "active_items", "active_customers"]
DEALER_WIDGETS_WITH_QUOTES = [
    "outstanding", "invoiced", "open_quotations", "open_sales_orders", "active_items", "active_customers",
]
POS_WIDGETS = ["todays_sales", "todays_cash", "todays_upi", "todays_card", "active_items", "active_customers"]
POS_WIDGETS_COMPACT = ["todays_sales", "todays_cash", "todays_upi", "todays_card", "active_items"]


def _flags(**overrides: bool) -> dict:
    base = {"batch_tracking": False, "expiry_tracking": False, "fefo": False, "weight_tracking": False}
    base.update(overrides)
    return base


# ADR-010 addendum: terminology now drives real UI, not just a
# read-only display on the Industry Configuration page -- item_label/
# items_label relabel the Items nav entry and page header, and the
# *_example keys replace the Items/Customers/Suppliers "new record"
# form placeholders (frontend: lib/navigation.ts's buildNavigation(),
# routes/ItemsPage.tsx, CustomersPage.tsx, procurement/SuppliersPage.tsx).
# Every profile below needs real values -- a building-materials example
# ("UltraTech OPC53 Cement 50KG") showing up as the placeholder for a
# print shop's own item form is exactly the cross-industry leak this
# fixes (reported live, ADR-010's second addendum).
PROFILE_DEFINITIONS: list[dict] = [
    {
        "slug": "building_materials",
        "name": "Building Materials",
        "category": "construction",
        "terminology": {"item_label": "Item", "items_label": "Items", "item_name_example": "UltraTech OPC53 Cement 50KG", "item_uom_example": "BAG", "customer_name_example": "Sri Balaji Constructions", "supplier_name_example": "UltraTech Cement Distributors"},
        "enabled_modules": [
            "sales",
            "purchase",
            "inventory",
            "warehouse",
            "dispatch",
            "fleet",
            "credit",
            "collections",
            "projects",
            "field_sales",
            "accounting",
            "gst",
        ],
        # Populated in Slice B to exactly mirror today's static
        # NAVIGATION_CONFIG -- left empty here in Slice A since nothing
        # reads it yet and the shape is owned by the frontend.
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS_WITH_QUOTES,
        "inventory_flags": _flags(batch_tracking=True, weight_tracking=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "retail",
        "name": "Retail Shop",
        "category": "retail",
        "terminology": {"item_label": "Product", "items_label": "Products", "item_name_example": "Nivea Body Lotion 200ml", "item_uom_example": "PCS", "customer_name_example": "Walk-in Customer", "supplier_name_example": "FastMoving Consumer Distributors"},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": POS_WIDGETS,
        "inventory_flags": _flags(),
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "pharmacy",
        "name": "Pharmacy",
        "category": "healthcare",
        "terminology": {"item_label": "Medicine", "items_label": "Medicines", "item_name_example": "Paracetamol 500mg Strip", "item_uom_example": "STRIP", "customer_name_example": "Walk-in Patient", "supplier_name_example": "MedPlus Pharma Distributors"},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": ["todays_sales", "near_expiry", "active_items", "active_customers"],
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True, fefo=True),
        "pricing_strategy": "pos_mrp_discount",
    },
    # -- The remaining 20 industries from the original brief's list.
    # Each is a plain config entry over the same generic core (sales,
    # inventory, POS, accounting/GST, dynamic attributes) proven by
    # Retail and Pharmacy above -- no migration, no new backend code.
    # Two (Travel, Real Estate) are honestly service/project-oriented,
    # not inventory-item businesses; they get sales/accounting only,
    # no inventory/pos/warehouse modules, rather than a misleading
    # module list. Their deeper domain models (property/unit/booking/
    # payment-schedule; package/itinerary/booking) from the original
    # spec are not built -- backlog, same as the ~19-industry gap this
    # comment used to describe before this batch.
    {
        "slug": "ecommerce",
        "name": "Ecommerce",
        "category": "ecommerce",
        "terminology": {"item_label": "Product", "items_label": "Products", "item_name_example": "Wireless Bluetooth Earbuds", "item_uom_example": "PCS", "customer_name_example": "Online Customer", "supplier_name_example": "Global Import Trading Co"},
        "enabled_modules": ["sales", "purchase", "inventory", "warehouse", "dispatch", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(),
        "pricing_strategy": "standard",
    },
    {
        "slug": "fmcg",
        "name": "FMCG",
        "category": "distribution",
        "terminology": {"item_label": "SKU", "items_label": "SKUs", "item_name_example": "Parle-G Biscuit 200g Pack", "item_uom_example": "CTN", "customer_name_example": "City Retail Store", "supplier_name_example": "HUL Regional Distributors"},
        "enabled_modules": [
            "sales", "purchase", "inventory", "warehouse", "dispatch",
            "credit", "collections", "field_sales", "accounting", "gst",
        ],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True, fefo=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "auto_parts",
        "name": "Auto Parts",
        "category": "automotive",
        "terminology": {"item_label": "Part", "items_label": "Parts", "item_name_example": "Bosch Brake Pad Set - Swift", "item_uom_example": "SET", "customer_name_example": "City Garage Works", "supplier_name_example": "Bosch Auto Parts Distributors"},
        "enabled_modules": ["sales", "purchase", "inventory", "warehouse", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS_WITH_QUOTES,
        "inventory_flags": _flags(),
        "pricing_strategy": "standard",
    },
    {
        "slug": "food_beverage",
        "name": "Food & Beverages",
        "category": "food",
        "terminology": {"item_label": "Menu Item", "items_label": "Menu Items", "item_name_example": "Masala Chai 200ml", "item_uom_example": "CUP", "customer_name_example": "Dine-in Customer", "supplier_name_example": "Fresh Farm Suppliers"},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": ["todays_sales", "near_expiry", "todays_cash", "todays_upi", "todays_card", "active_items"],
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True, fefo=True),
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "chemical",
        "name": "Chemical",
        "category": "chemical",
        "terminology": {"item_label": "Chemical", "items_label": "Chemicals", "item_name_example": "Sodium Hydroxide 25kg Drum", "item_uom_example": "DRUM", "customer_name_example": "ABC Textile Processors", "supplier_name_example": "Deepak Chemicals Distributors"},
        "enabled_modules": ["sales", "purchase", "inventory", "warehouse", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True, weight_tracking=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "computer_hardware",
        "name": "Computer Hardware",
        "category": "electronics",
        "terminology": {"item_label": "Product", "items_label": "Products", "item_name_example": "Logitech Wireless Mouse M235", "item_uom_example": "PCS", "customer_name_example": "Sri Computers Retail", "supplier_name_example": "Rashi Peripherals Distributors"},
        "enabled_modules": ["sales", "purchase", "inventory", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(serial_tracking=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "furniture",
        "name": "Furniture",
        "category": "furniture",
        "terminology": {"item_label": "Item", "items_label": "Items", "item_name_example": "Sheesham Wood Dining Table 6-Seater", "item_uom_example": "PCS", "customer_name_example": "Interior Decor Studio", "supplier_name_example": "Jodhpur Wood Craft Suppliers"},
        "enabled_modules": ["sales", "purchase", "inventory", "projects", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS_WITH_QUOTES,
        "inventory_flags": _flags(),
        "pricing_strategy": "standard",
    },
    {
        "slug": "book_publishing",
        "name": "Book Publishing",
        "category": "publishing",
        "terminology": {"item_label": "Title", "items_label": "Titles", "item_name_example": "NCERT Mathematics Class 10", "item_uom_example": "PCS", "customer_name_example": "City Book Depot", "supplier_name_example": "National Book Trust Distributors"},
        "enabled_modules": ["sales", "purchase", "inventory", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(),
        "pricing_strategy": "standard",
    },
    {
        "slug": "travel",
        "name": "Travel",
        "category": "services",
        "terminology": {"item_label": "Package", "items_label": "Packages", "item_name_example": "Goa 4N/5D Family Package", "item_uom_example": "PKG", "customer_name_example": "Individual Traveller", "supplier_name_example": "Local Transport & Hotel Vendor"},
        "enabled_modules": ["sales", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS_WITH_QUOTES,
        "inventory_flags": {},
        "pricing_strategy": "service",
    },
    {
        "slug": "electrical",
        "name": "Electrical",
        "category": "construction",
        "terminology": {"item_label": "Item", "items_label": "Items", "item_name_example": "Havells MCB 32A Single Pole", "item_uom_example": "PCS", "customer_name_example": "Local Electrical Contractor", "supplier_name_example": "Havells Regional Distributors"},
        "enabled_modules": [
            "sales", "purchase", "inventory", "warehouse", "dispatch",
            "projects", "credit", "collections", "accounting", "gst",
        ],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS_WITH_QUOTES,
        "inventory_flags": _flags(),
        "pricing_strategy": "standard",
    },
    {
        "slug": "paper_mill",
        "name": "Paper Mill",
        "category": "manufacturing",
        "terminology": {"item_label": "Product", "items_label": "Products", "item_name_example": "80 GSM Copier Paper Reel", "item_uom_example": "MT", "customer_name_example": "Print & Packaging Buyer", "supplier_name_example": "Pulp & Waste Paper Suppliers"},
        "enabled_modules": ["sales", "purchase", "inventory", "warehouse", "dispatch", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(batch_tracking=True, weight_tracking=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "paint",
        "name": "Paint",
        "category": "construction",
        "terminology": {"item_label": "Product", "items_label": "Products", "item_name_example": "Asian Paints Tractor Emulsion 20L", "item_uom_example": "LTR", "customer_name_example": "Local Paint Contractor", "supplier_name_example": "Asian Paints Regional Distributors"},
        "enabled_modules": ["sales", "purchase", "inventory", "warehouse", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "mobile",
        "name": "Mobile Store",
        "category": "electronics",
        "terminology": {"item_label": "Product", "items_label": "Products", "item_name_example": "Samsung Galaxy M14 128GB", "item_uom_example": "PCS", "customer_name_example": "Walk-in Customer", "supplier_name_example": "Samsung Authorized Distributors"},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": POS_WIDGETS_COMPACT,
        "inventory_flags": _flags(serial_tracking=True),
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "garments",
        "name": "Garments",
        "category": "fashion",
        "terminology": {"item_label": "Style", "items_label": "Styles", "item_name_example": "Men's Cotton Formal Shirt - White", "item_uom_example": "PCS", "customer_name_example": "Retail Boutique Buyer", "supplier_name_example": "Tirupur Garment Manufacturers"},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": POS_WIDGETS,
        "inventory_flags": _flags(),
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "jewellery",
        "name": "Jewellery",
        "category": "fashion",
        "terminology": {"item_label": "Item", "items_label": "Items", "item_name_example": "22K Gold Necklace Set - 25g", "item_uom_example": "PCS", "customer_name_example": "Wedding Customer", "supplier_name_example": "Local Karigar Workshop"},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "credit", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": ["todays_sales", "active_items", "active_customers"],
        "inventory_flags": _flags(weight_tracking=True, serial_tracking=True),
        # Metal rate + weight + making charges + wastage + stone charges
        # (dev.md sec27) -- informational, like every other pricing_strategy
        # value here; resolve_price() itself is unchanged, still
        # rate-contract > customer-price > standard_price for every profile.
        "pricing_strategy": "weight_making_wastage",
    },
    {
        "slug": "agriculture",
        "name": "Agriculture",
        "category": "agriculture",
        "terminology": {"item_label": "Input", "items_label": "Inputs", "item_name_example": "Urea Fertilizer 50kg Bag", "item_uom_example": "BAG", "customer_name_example": "Local Farmer", "supplier_name_example": "IFFCO Regional Distributors"},
        "enabled_modules": ["sales", "purchase", "inventory", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True, fefo=True, weight_tracking=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "stationery",
        "name": "Stationery",
        "category": "retail",
        "terminology": {"item_label": "Item", "items_label": "Items", "item_name_example": "Classmate Notebook 172pg Single Line", "item_uom_example": "PCS", "customer_name_example": "School Supplies Buyer", "supplier_name_example": "ITC Stationery Distributors"},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": POS_WIDGETS_COMPACT,
        "inventory_flags": _flags(),
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "electronics",
        "name": "Electronics",
        "category": "electronics",
        "terminology": {"item_label": "Product", "items_label": "Products", "item_name_example": "LG 1.5 Ton Split AC", "item_uom_example": "PCS", "customer_name_example": "Walk-in Customer", "supplier_name_example": "LG Electronics Regional Distributors"},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": ["todays_sales", "active_items", "active_customers"],
        "inventory_flags": _flags(serial_tracking=True),
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "real_estate",
        "name": "Real Estate",
        "category": "services",
        "terminology": {"item_label": "Unit", "items_label": "Units", "item_name_example": "2BHK Flat - Tower A, Floor 5", "item_uom_example": "UNIT", "customer_name_example": "Prospective Buyer", "supplier_name_example": "Building Material Contractor"},
        "enabled_modules": ["sales", "projects", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": ["outstanding", "invoiced", "open_quotations", "active_customers"],
        "inventory_flags": {},
        "pricing_strategy": "service",
    },
    {
        "slug": "grocery",
        "name": "Grocery",
        "category": "retail",
        "terminology": {"item_label": "Product", "items_label": "Products", "item_name_example": "Tata Salt 1kg Pack", "item_uom_example": "PCS", "customer_name_example": "Walk-in Customer", "supplier_name_example": "Local Kirana Wholesale Distributor"},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": POS_WIDGETS_COMPACT,
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True, fefo=True, weight_tracking=True),
        "pricing_strategy": "pos_mrp_discount",
    },
    # -- Printing Press / Digital Color Lab (ADR-011). Unlike every
    # profile above, this one is NOT config-only: "printing" is a real
    # module backed by new tables (PrintJob/PrintJobArtwork/PrintMachine)
    # and a real job-lifecycle service, because the spec driving it is
    # explicit that a print shop is Customer->Job->Artwork->Prepress->
    # Production->Finishing->QC->Delivery->Invoice->Profitability, not
    # products-in-a-cart -- forcing it through the generic sales/pos
    # module set the way Retail/Grocery/etc. were would have been
    # dishonest, not just under-scoped.
    {
        "slug": "printing_press",
        "name": "Printing Press & Digital Color Lab",
        "category": "printing",
        "terminology": {"item_label": "Material", "items_label": "Materials", "item_name_example": "A4 80GSM Paper Ream", "item_uom_example": "REAM", "customer_name_example": "ABC Corporate Pvt Ltd", "supplier_name_example": "JK Paper Distributors"},
        "enabled_modules": ["printing", "purchase", "inventory", "projects", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": [
            "jobs_due_today", "jobs_overdue", "jobs_in_production", "outstanding", "active_customers",
        ],
        # weight/batch/expiry/fefo don't apply to a print shop's own
        # stock (paper/ink, tracked as ordinary Items) the way they do
        # for a pharmacy or grocer -- left at the _flags() defaults
        # (all False) rather than padded with irrelevant flags.
        "inventory_flags": _flags(),
        "pricing_strategy": "job_costing",
    },
]


def ensure_industry_profile_catalog(db: Session) -> None:
    """Flush-only, not commit -- same reasoning as
    services/permissions.py::ensure_permission_catalog, which this
    mirrors exactly: composable with any caller's own transaction
    (main.py's lifespan, tenant_signup.py, or the industry-profiles
    list endpoint), each of which commits on its own terms."""
    existing_slugs = {p.slug for p in db.execute(select(IndustryProfile)).scalars().all()}
    for definition in PROFILE_DEFINITIONS:
        if definition["slug"] not in existing_slugs:
            db.add(IndustryProfile(**definition))
    db.flush()


def get_profile_by_slug(db: Session, slug: str) -> IndustryProfile | None:
    return db.execute(select(IndustryProfile).where(IndustryProfile.slug == slug)).scalar_one_or_none()
