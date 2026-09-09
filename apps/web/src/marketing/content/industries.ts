import type { IndustryContent } from "./types";

/** Every real industry slug/name/category, mirrored from
 * apps/api/app/services/industry.py's PROFILE_DEFINITIONS -- used by
 * the industries directory page to list all 24 supported industries
 * even though only 5 have a full content entry below (INDUSTRIES).
 * The other 19 render as plain, unlinked list items rather than thin
 * pages -- adding real content for one later is a new entry in
 * INDUSTRIES, no code change. */
export const ALL_INDUSTRIES: { slug: string; name: string; category: string }[] = [
  { slug: "building_materials", name: "Building Materials", category: "construction" },
  { slug: "retail", name: "Retail Shop", category: "retail" },
  { slug: "pharmacy", name: "Pharmacy", category: "healthcare" },
  { slug: "ecommerce", name: "Ecommerce", category: "ecommerce" },
  { slug: "fmcg", name: "FMCG", category: "distribution" },
  { slug: "auto_parts", name: "Auto Parts", category: "automotive" },
  { slug: "food_beverage", name: "Food & Beverages", category: "food" },
  { slug: "chemical", name: "Chemical", category: "chemical" },
  { slug: "computer_hardware", name: "Computer Hardware", category: "electronics" },
  { slug: "furniture", name: "Furniture", category: "furniture" },
  { slug: "book_publishing", name: "Book Publishing", category: "publishing" },
  { slug: "travel", name: "Travel", category: "services" },
  { slug: "electrical", name: "Electrical", category: "construction" },
  { slug: "paper_mill", name: "Paper Mill", category: "manufacturing" },
  { slug: "paint", name: "Paint", category: "construction" },
  { slug: "mobile", name: "Mobile Store", category: "electronics" },
  { slug: "garments", name: "Garments", category: "fashion" },
  { slug: "jewellery", name: "Jewellery", category: "fashion" },
  { slug: "agriculture", name: "Agriculture", category: "agriculture" },
  { slug: "stationery", name: "Stationery", category: "retail" },
  { slug: "electronics", name: "Electronics", category: "electronics" },
  { slug: "real_estate", name: "Real Estate", category: "services" },
  { slug: "grocery", name: "Grocery", category: "retail" },
  { slug: "printing_press", name: "Printing Press & Digital Color Lab", category: "printing" },
];

/** Fully-authored industry landing pages -- deliberately only the 5
 * where MaterialOS has real, tested, shipped functionality to describe
 * (no generic filler). Cross-checked by hand against each slug's real
 * enabled_modules/inventory_flags in services/industry.py at the time
 * of writing -- keep them in sync if that catalog changes. */
export const INDUSTRIES: IndustryContent[] = [
  {
    slug: "building_materials",
    name: "Building Materials",
    category: "construction",
    seoTitle: "Building Materials ERP -- Cement, Steel & TMT Dealer Software | MaterialOS",
    seoDescription:
      "Run a cement, steel, or TMT dealership on one system: quotations, credit-checked sales orders, warehouse dispatch, fleet delivery, and GST accounting.",
    keywords: [
      "building materials ERP", "cement dealer software", "steel dealer software",
      "TMT inventory management", "construction material inventory", "dealer credit management",
      "building material billing", "construction material delivery management",
    ],
    heroTagline: "One system for your cement, steel, and TMT dealership.",
    problems: [
      "Stock is tracked in one register, credit in another, and delivery status lives in a driver's phone call.",
      "A customer's outstanding balance isn't visible at the moment a new order is taken, so credit limits get breached.",
      "TMT/steel stock is sold by weight as well as by piece, and most billing software only handles one.",
      "Dispatch and delivery have no paper trail until an invoice shows up days later.",
    ],
    solution:
      "MaterialOS runs the full dealer cycle -- quotation, credit check, sales order, warehouse picking, dispatch, delivery, invoice, and collection -- as one connected flow, with real-time stock and outstanding balances instead of end-of-day reconciliation.",
    capabilities: [
      "Quotation to sales order with an automatic customer credit-limit check before the order is confirmed",
      "Warehouse stock reservation and picking, with weight tracking for TMT/steel sold by both piece and kg",
      "Dispatch board and fleet/vehicle tracking through to proof of delivery",
      "Customer credit management and collections/ageing",
      "Site/project-linked sales for contractors buying against a specific job",
      "Field sales check-in for reps visiting sites and dealers",
      "GST-compliant invoicing, e-way bills, and full accounting (trial balance, P&L, balance sheet)",
    ],
    workflow: [
      "Quotation", "Credit Check", "Sales Order", "Stock Reservation", "Picking", "Dispatch", "Delivery", "Invoice", "Collection",
    ],
    useCases: [
      "A cement dealer confirming a bulk order only after the system verifies the buyer is within their credit limit.",
      "A TMT steel trader billing a mixed order of full bundles (by piece) and cut lengths (by weight) on one invoice.",
      "A building materials supplier dispatching to three active construction sites in one day, each tracked back to its project.",
    ],
    faqs: [
      {
        q: "What is building material inventory software?",
        a: "It's software that tracks cement, steel, TMT, and other construction material stock by quantity and weight, links that stock to sales orders and dispatch, and keeps warehouse balances accurate in real time instead of relying on a manual register.",
      },
      {
        q: "Can it handle TMT steel sold by both weight and piece?",
        a: "Yes -- MaterialOS's inventory supports weight tracking alongside piece counts, so a single item like 12mm TMT can be billed by bundle or by kg on the same invoice.",
      },
      {
        q: "Does it check customer credit automatically?",
        a: "Yes -- every sales order is checked against the customer's credit limit (opening balance plus posted invoices minus receipts and returns) before it's confirmed, not after.",
      },
    ],
    relatedIndustrySlugs: ["electrical", "paint", "paper_mill"],
    relatedFeatureSlugs: ["credit-management", "warehouse-dispatch-management", "sales-quotation-management"],
  },
  {
    slug: "retail",
    name: "Retail Shop",
    category: "retail",
    seoTitle: "Retail Shop Management Software -- Billing, Inventory & POS | MaterialOS",
    seoDescription:
      "Point-of-sale billing, MRP-and-discount pricing, and real-time stock for retail shops -- cash, UPI, and card in one split payment.",
    keywords: [
      "retail shop management software", "retail POS software", "inventory management software",
      "billing and accounting software", "shop billing software",
    ],
    heroTagline: "Fast counter billing with real-time stock, built for retail.",
    problems: [
      "Billing at the counter is slow when the till and the stock register are two different systems.",
      "Split payments (part cash, part UPI) are hard to record cleanly in basic billing software.",
      "Stock counts drift from the shelf because sales aren't deducted from inventory in real time.",
    ],
    solution:
      "MaterialOS's point of sale is barcode/search-driven, prices off MRP with a per-line or per-bill discount, accepts a true split of cash/UPI/card in one checkout, and posts the sale straight to the stock ledger and accounting -- no end-of-day reconciliation step.",
    capabilities: [
      "Barcode or search-based POS checkout with split cash/UPI/card payment",
      "MRP-minus-discount pricing tuned for counter retail, not project billing",
      "Real-time stock deduction on every sale -- no manual closing-stock entry",
      "Purchase and supplier billing for restocking",
      "GST-compliant billing and accounting",
    ],
    workflow: ["Scan / Search Item", "Add to Cart", "Apply Discount", "Split Payment (Cash/UPI/Card)", "Print Receipt", "Stock Deducted"],
    useCases: [
      "A general store owner running the whole counter -- scan, discount, split payment, receipt -- in under a minute per customer.",
      "A shop tracking exactly how much of today's revenue came in as UPI versus cash at closing time.",
    ],
    faqs: [
      {
        q: "What is retail shop management software?",
        a: "Software that combines point-of-sale billing with inventory and accounting, so every sale at the counter updates stock and books automatically instead of needing a separate closing-stock count.",
      },
      {
        q: "Can I split a bill between cash and UPI?",
        a: "Yes -- MaterialOS's POS checkout accepts a true split across cash, UPI, and card on a single bill, and each method is tracked separately on the dashboard.",
      },
    ],
    relatedIndustrySlugs: ["grocery", "stationery", "mobile"],
    relatedFeatureSlugs: ["pos", "inventory-management"],
  },
  {
    slug: "pharmacy",
    name: "Pharmacy",
    category: "healthcare",
    seoTitle: "Pharmacy Management Software -- Batch, Expiry & FEFO Billing | MaterialOS",
    seoDescription:
      "Pharmacy billing software with batch and expiry tracking, FEFO-ordered stock picking, and a near-expiry dashboard -- so nothing gets sold or wasted past its date.",
    keywords: [
      "pharmacy management software", "pharmacy billing software", "batch expiry management",
      "FEFO inventory", "medicine inventory software",
    ],
    heroTagline: "Batch, expiry, and FEFO -- built into the stock ledger, not bolted on.",
    problems: [
      "Medicine stock has a batch and an expiry date; most basic billing software tracks neither.",
      "Without FEFO (first-expiry-first-out), the oldest stock sits on the shelf while newer batches sell first, and stock quietly expires.",
      "There's no early warning before a batch is about to expire, so loss is discovered only at a physical stock check.",
    ],
    solution:
      "MaterialOS tracks every medicine's batch and expiry date on the stock ledger itself, automatically picks the earliest-expiring batch first on a sale, and surfaces a near-expiry list on the dashboard well before stock actually goes bad.",
    capabilities: [
      "Batch and expiry-date tracking on every medicine, not a separate spreadsheet",
      "FEFO (first-expiry-first-out) stock picking, automatic on every sale",
      "Near-expiry dashboard widget so stock is flagged before it's a write-off",
      "POS billing with MRP-and-discount pricing for walk-in patients",
      "Purchase, supplier billing, and GST-compliant accounting",
    ],
    workflow: ["Goods Receipt (Batch + Expiry Recorded)", "FEFO-Ordered Stock", "POS Sale", "Earliest Batch Auto-Picked", "Near-Expiry Alert Before Loss"],
    useCases: [
      "A pharmacist billing a strip of paracetamol and having the system automatically pull from the batch expiring soonest.",
      "A pharmacy owner checking the near-expiry widget every Monday to plan returns or discounted clearance before stock is written off.",
    ],
    faqs: [
      {
        q: "What is FEFO and why does it matter for a pharmacy?",
        a: "FEFO (first-expiry-first-out) means the batch closest to its expiry date is sold first. Without it, newer stock sells first by default and older batches are left to expire on the shelf, becoming a direct loss.",
      },
      {
        q: "Does the system track expiry dates automatically?",
        a: "Yes -- expiry date is recorded per batch at goods receipt, and a near-expiry dashboard widget surfaces stock approaching its date well before it becomes unsellable.",
      },
    ],
    relatedIndustrySlugs: ["food_beverage", "chemical", "grocery"],
    relatedFeatureSlugs: ["inventory-management", "pos"],
  },
  {
    slug: "printing_press",
    name: "Printing Press & Digital Color Lab",
    category: "printing",
    seoTitle: "Print Shop Management Software -- Job Tracking & Production Board | MaterialOS",
    seoDescription:
      "Track every print job from order to delivery on a production board -- job status, overdue jobs, and material stock (paper, ink) in one system.",
    keywords: [
      "printing press management software", "print job management", "digital color lab software",
      "print shop production tracking",
    ],
    heroTagline: "Know exactly which print job is late before your customer asks.",
    problems: [
      "Print jobs move through several stages (design approval, print, finishing, delivery) with no shared status board.",
      "It's hard to know how many jobs are overdue without asking the production floor directly.",
      "Paper, ink, and other consumables are tracked separately from the jobs that consume them.",
    ],
    solution:
      "MaterialOS gives a print shop a real production board: every job's status, due date, and overdue flag in one view, alongside ordinary inventory tracking for paper and ink stock and project-linked billing for corporate customers.",
    capabilities: [
      "Production board showing jobs due today, overdue jobs, and jobs in production",
      "Per-job tracking through to delivery, linked to the customer and project",
      "Material stock (paper, ink, consumables) tracked as ordinary inventory items",
      "Customer credit management and collections for corporate accounts",
      "GST-compliant billing and accounting",
    ],
    workflow: ["Job Received", "In Production", "Quality Check", "Delivery", "Invoice"],
    useCases: [
      "A print shop manager scanning the production board each morning to see every job due today and any that are already overdue.",
      "A digital lab billing a corporate customer's recurring print job against the same project every month.",
    ],
    faqs: [
      {
        q: "Can I see which print jobs are overdue at a glance?",
        a: "Yes -- the production board dashboard shows jobs due today, jobs already overdue, and jobs currently in production as live counts, not a report you have to run.",
      },
    ],
    relatedIndustrySlugs: ["stationery", "book_publishing"],
    relatedFeatureSlugs: ["inventory-management", "sales-quotation-management"],
  },
  {
    slug: "mobile",
    name: "Mobile Store",
    category: "electronics",
    seoTitle: "Mobile Shop Software -- IMEI Tracking, Billing & RMA | MaterialOS",
    seoDescription:
      "Sell phones with per-unit IMEI/serial tracking, warranty dates, and a real RMA workflow for returns and repairs -- not just a generic stock count.",
    keywords: [
      "mobile store software", "IMEI tracking software", "mobile shop billing software",
      "serial number inventory", "electronics warranty tracking", "RMA management software",
    ],
    heroTagline: "Every phone tracked by its own IMEI, from stock to warranty claim.",
    problems: [
      "A phone isn't just \"1 unit of stock\" -- each one has its own IMEI, and a generic quantity-based system can't tell them apart.",
      "When a customer brings a phone back for a warranty repair, there's no structured way to log it, track its repair status, or resolve it.",
      "Warranty expiry dates aren't tracked per device, so a shop can't tell at a glance whether a return is still covered.",
    ],
    solution:
      "MaterialOS registers every phone by its own serial/IMEI number alongside the ordinary stock ledger, records warranty expiry per unit, and runs a real RMA workflow -- requested, approved, in repair, resolved -- so returns and warranty claims are tracked, not handled from memory.",
    capabilities: [
      "Per-unit serial/IMEI registration, linked to the item it belongs to and the sale it came from",
      "Warranty expiry tracked per device, not per product line",
      "A full RMA (return merchandise authorization) workflow: requested, approved, in repair, resolved or rejected",
      "POS billing with MRP-and-discount pricing for walk-in customers",
      "Ordinary inventory, purchase, and GST-compliant accounting underneath",
    ],
    workflow: ["IMEI Registered at Purchase", "Sold Against a Specific Unit", "Customer RMA Request", "Approved -> In Repair", "Resolved (Repaired / Replaced / Rejected)"],
    useCases: [
      "A mobile shop selling a phone and having its IMEI automatically linked to that specific sale, not just a generic stock count.",
      "A customer returning a phone for a screen issue, with the shop tracking the RMA from request through repair to resolution instead of a handwritten note.",
    ],
    faqs: [
      {
        q: "Can the system track individual phones by IMEI, not just total stock count?",
        a: "Yes -- each unit is registered with its own serial/IMEI number, warehouse, and warranty expiry, separate from the ordinary quantity-based stock ledger.",
      },
      {
        q: "What is RMA and does MaterialOS support it?",
        a: "RMA (return merchandise authorization) is the process of tracking a returned or faulty unit through approval, repair, and resolution. MaterialOS runs this as a real workflow tied to the unit's own serial number, not a manual note.",
      },
    ],
    relatedIndustrySlugs: ["computer_hardware", "electronics"],
    relatedFeatureSlugs: ["serial-imei-rma-tracking", "pos"],
  },
];

export function getIndustryBySlug(slug: string): IndustryContent | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}
