import type { FeatureContent } from "./types";

/** 8 flagship feature pages -- all real, tested, shipped capabilities.
 * Deliberately no AI-named features here (ai-business-copilot,
 * ai-demand-forecasting, ai-document-reader): the AI layer is out of
 * scope for MaterialOS right now, and a marketing page claiming it
 * would be describing functionality that doesn't exist. */
export const FEATURES: FeatureContent[] = [
  {
    slug: "inventory-management",
    name: "Inventory Management",
    seoTitle: "Inventory Management Software -- Real-Time Stock Ledger | MaterialOS",
    seoDescription:
      "A stock ledger that updates on every sale, purchase, transfer, and return -- with batch, expiry, weight, and serial tracking where your business needs it.",
    keywords: ["inventory management software", "stock management software", "real-time inventory tracking"],
    problem:
      "Stock counts drift from reality when sales, purchases, and transfers are recorded in different places, or only reconciled at month-end.",
    solutionSummary:
      "Every stock movement -- a sale, a purchase, a warehouse transfer, a return -- posts to one ledger immediately, so the balance on screen is the balance on the shelf.",
    howItWorks: [
      "Every document that touches stock (invoice, purchase bill, transfer, return) posts a signed movement to the stock ledger.",
      "Stock balance per item per warehouse is a live projection of that ledger, not a manually-entered number.",
      "Optional per-industry tracking -- batch and expiry, weight, or serial/IMEI -- layers onto the same ledger without a separate system.",
    ],
    benefits: [
      "No end-of-day or end-of-month stock reconciliation",
      "Multi-warehouse balances visible in real time",
      "The same ledger powers dispatch, purchase, and accounting -- no duplicate data entry",
    ],
    workflow: ["Purchase / Sale / Transfer / Return", "Signed Movement Posted", "Stock Balance Updated", "Available Everywhere Instantly"],
    relatedIndustrySlugs: ["building_materials", "pharmacy", "printing_press"],
    faqs: [
      {
        q: "How often does the stock balance update?",
        a: "Immediately -- every sale, purchase, transfer, or return posts to the stock ledger as part of that same transaction, not on a delay or a batch job.",
      },
    ],
  },
  {
    slug: "sales-quotation-management",
    name: "Sales & Quotation Management",
    seoTitle: "Quotation & Sales Order Software | MaterialOS",
    seoDescription:
      "Turn a quotation into a credit-checked sales order, dispatch, and invoice without re-entering the same line items three times.",
    keywords: ["quotation software", "sales order management", "how to manage quotations and sales orders"],
    problem:
      "A quotation, sales order, and invoice are usually three separate documents, re-typed by hand, with no guarantee they match by the time the invoice is raised.",
    solutionSummary:
      "MaterialOS converts a quotation straight into a sales order (with an automatic credit check), then into dispatch and invoice, carrying the same line items forward at every stage.",
    howItWorks: [
      "A quotation is built against real item pricing and tax rates.",
      "Approving it and converting to a sales order runs a customer credit-limit check before confirming.",
      "The sales order drives warehouse reservation, dispatch, and finally invoicing -- the same items and quantities throughout.",
    ],
    benefits: ["No re-typing line items between quotation, order, and invoice", "Credit risk caught before the order is confirmed, not after", "Full traceability from quotation to final invoice"],
    workflow: ["Quotation", "Approval", "Credit Check", "Sales Order", "Dispatch", "Invoice"],
    relatedIndustrySlugs: ["building_materials", "furniture", "electrical"],
    faqs: [
      {
        q: "Does converting a quotation to an order re-enter the line items?",
        a: "No -- the sales order is generated directly from the approved quotation's own line items, quantities, and pricing.",
      },
    ],
  },
  {
    slug: "credit-management",
    name: "Customer Credit Management",
    seoTitle: "Customer Credit Management Software -- Automatic Credit Checks | MaterialOS",
    seoDescription:
      "Every sales order is checked against the customer's real credit limit -- opening balance plus posted invoices, minus receipts and returns -- before it's confirmed.",
    keywords: ["customer credit management", "how to manage customer credit", "credit limit software"],
    problem: "Credit limits are breached because outstanding balance isn't checked at the moment a new order is placed, only discovered later on a statement.",
    solutionSummary:
      "MaterialOS computes each customer's real outstanding balance -- opening balance plus posted invoices, minus allocated receipts and sales returns -- and checks it automatically before a sales order is confirmed.",
    howItWorks: [
      "Outstanding balance is calculated live: opening balance + posted invoice totals - allocated receipts - sales returns.",
      "A new sales order is checked against the customer's credit limit before confirmation, not after.",
      "Collections and ageing views use the same real-time balance, not a stale monthly statement.",
    ],
    benefits: ["Credit risk caught before the sale is confirmed", "One real-time balance shared by sales, collections, and the customer's own account view", "No manual statement reconciliation"],
    workflow: ["Sales Order Requested", "Outstanding Balance Computed", "Checked Against Credit Limit", "Order Confirmed or Blocked"],
    relatedIndustrySlugs: ["building_materials", "auto_parts", "chemical"],
    faqs: [
      {
        q: "How is outstanding balance calculated?",
        a: "Opening balance plus every posted invoice, minus receipts actually allocated against those invoices and any sales returns -- computed live, not from a static statement.",
      },
    ],
  },
  {
    slug: "pos",
    name: "Point of Sale",
    seoTitle: "Point of Sale (POS) Software -- Barcode Billing & Split Payments | MaterialOS",
    seoDescription:
      "Barcode or search-based checkout with true split cash, UPI, and card payments -- posts straight to stock and accounting.",
    keywords: ["point of sale software", "POS billing software", "retail checkout software"],
    problem: "Counter billing is slow and disconnected from stock when POS and inventory are two separate systems.",
    solutionSummary:
      "MaterialOS's POS is barcode/search-driven, supports MRP-and-discount pricing, accepts a genuine split of cash/UPI/card on one bill, and deducts stock the instant the sale is completed.",
    howItWorks: [
      "Scan a barcode or search by name/SKU to add an item to the cart.",
      "Apply a per-line or whole-bill discount off MRP.",
      "Split the payment across cash, UPI, and card in any combination, then print the receipt.",
      "Stock and accounting update immediately -- no separate closing entry.",
    ],
    benefits: ["Fast counter checkout", "Real split-payment tracking by method", "No manual stock deduction step"],
    workflow: ["Scan / Search", "Cart", "Discount", "Split Payment", "Receipt", "Stock & Accounting Updated"],
    relatedIndustrySlugs: ["retail", "pharmacy", "mobile"],
    faqs: [
      { q: "Can a single bill be paid partly in cash and partly by UPI?", a: "Yes -- POS checkout supports a true split across cash, UPI, and card on one bill." },
    ],
  },
  {
    slug: "warehouse-dispatch-management",
    name: "Warehouse & Dispatch Management",
    seoTitle: "Warehouse & Dispatch Management Software | MaterialOS",
    seoDescription:
      "Reserve stock, pick it, dispatch it, and confirm delivery -- with a dispatch board and fleet tracking through to proof of delivery.",
    keywords: ["warehouse management software", "dispatch management software", "how to track delivery vehicles"],
    problem: "Once an order is confirmed, there's often no visibility into whether it's been picked, dispatched, or actually delivered until an invoice appears.",
    solutionSummary:
      "MaterialOS reserves stock against a confirmed sales order, tracks it through picking and dispatch on a live board, and follows it to delivery with fleet/vehicle assignment and proof of delivery.",
    howItWorks: [
      "A confirmed sales order reserves the required stock in the warehouse.",
      "Warehouse picking is tracked against that reservation.",
      "Dispatch assigns a vehicle/trip; the dispatch board shows every order's live status.",
      "Delivery is confirmed with proof of delivery, closing the loop back to invoicing.",
    ],
    benefits: ["Live status for every order from reservation to delivery", "No stock double-booked across two orders", "A single dispatch board instead of phone calls to drivers"],
    workflow: ["Stock Reservation", "Picking", "Dispatch (Vehicle/Trip Assigned)", "Delivery", "Proof of Delivery"],
    relatedIndustrySlugs: ["building_materials", "ecommerce", "fmcg"],
    faqs: [
      { q: "Can I see which orders are dispatched but not yet delivered?", a: "Yes -- the dispatch board shows every order's live status from reservation through to confirmed delivery." },
    ],
  },
  {
    slug: "serial-imei-rma-tracking",
    name: "Serial/IMEI & RMA Tracking",
    seoTitle: "Serial Number & IMEI Tracking Software with RMA Workflow | MaterialOS",
    seoDescription:
      "Register stock by individual serial/IMEI number with warranty dates, and run a real RMA workflow for returns and repairs.",
    keywords: ["serial number inventory software", "IMEI tracking software", "RMA management software", "warranty tracking software"],
    problem: "Serialized goods (phones, electronics, appliances) need to be tracked as individual units with their own warranty and return history, not as an undifferentiated quantity.",
    solutionSummary:
      "MaterialOS registers each unit by its own serial/IMEI number alongside the ordinary stock ledger, tracks warranty expiry per unit, and runs an RMA workflow -- requested, approved, in repair, resolved -- for returns and warranty claims.",
    howItWorks: [
      "Each unit is registered with a serial/IMEI number, linked to the item and (once sold) the invoice it came from.",
      "Warranty expiry is tracked per unit.",
      "A customer return opens an RMA against that specific unit, moving through a real approve/repair/resolve workflow rather than a note.",
    ],
    benefits: ["Know exactly which unit was sold to which customer", "Warranty status checked per device, not per product line", "A structured, auditable return/repair process"],
    workflow: ["Unit Registered (Serial/IMEI)", "Sold Against a Specific Unit", "RMA Requested", "Approved -> In Repair", "Resolved"],
    relatedIndustrySlugs: ["mobile", "computer_hardware", "electronics"],
    faqs: [
      { q: "Does this replace the normal stock ledger?", a: "No -- it's additive. Ordinary quantity-based stock tracking is unchanged; serialized items get individual unit records layered on top for the goods that need it." },
    ],
  },
  {
    slug: "gst-accounting-financial-reports",
    name: "GST Accounting & Financial Reports",
    seoTitle: "GST-Compliant Accounting Software -- Trial Balance, P&L, Balance Sheet | MaterialOS",
    seoDescription:
      "Every sale and purchase posts a balanced journal automatically -- trial balance, general ledger, profit & loss, balance sheet, and cash flow, always in sync.",
    keywords: ["GST accounting software", "ERP software for small business", "how to calculate product margin"],
    problem: "Accounting is often kept separately from sales and purchase records, so books fall out of sync with what actually happened in the business.",
    solutionSummary:
      "Every invoice, purchase bill, receipt, and payment in MaterialOS posts a real, balanced double-entry journal automatically -- the trial balance, general ledger, P&L, balance sheet, and cash flow reports are always current, not a separate reconciliation step.",
    howItWorks: [
      "Every transactional document (invoice, purchase bill, receipt, payment, return) posts its own balanced journal entry at the moment it's created.",
      "Standard reports -- trial balance, general ledger, profit & loss, balance sheet, cash flow -- read directly from that journal.",
      "GST is calculated per transaction using the item's tax rate and the place of supply, ready for filing.",
    ],
    benefits: ["Books that are always in sync with sales and purchase activity", "No manual journal entries for routine transactions", "GST-ready reports without a separate reconciliation pass"],
    workflow: ["Invoice / Bill / Receipt / Payment", "Balanced Journal Posted Automatically", "Reports Read Live From the Journal"],
    relatedIndustrySlugs: ["building_materials", "chemical", "furniture"],
    faqs: [
      { q: "Do I need to make manual journal entries for regular sales and purchases?", a: "No -- every invoice, purchase bill, receipt, and payment posts its own balanced journal entry automatically." },
    ],
  },
  {
    slug: "report-builder",
    name: "Report Builder",
    seoTitle: "Custom Report Builder -- Build Your Own Business Reports | MaterialOS",
    seoDescription:
      "Group and measure real business data -- sales, purchases, outstanding, stock -- into a table or chart, and export to CSV. No fixed report list.",
    keywords: ["custom reports software", "business reporting software", "advanced reports"],
    problem: "Fixed, pre-built reports rarely match the exact way a business wants to slice its own data -- by customer, by month, by status, by item.",
    solutionSummary:
      "MaterialOS's report builder lets you pick a real dataset (sales invoices, purchase bills, customer outstanding, item stock), a way to group it, and a measure -- rendered as a table or chart, exportable to CSV -- without writing a query.",
    howItWorks: [
      "Choose a dataset: sales invoices, purchase bills, customer outstanding, or item stock on hand.",
      "Choose how to group it (by customer, supplier, month, status, item, or warehouse) and what to measure (total value, count, outstanding amount, quantity).",
      "View as a table or bar chart, and export the result to CSV.",
    ],
    benefits: ["No fixed report list to work around", "Every role only sees the datasets their permissions allow", "CSV export for anything built"],
    workflow: ["Pick Dataset", "Pick Group By", "Pick Measure", "View Table or Chart", "Export CSV"],
    relatedIndustrySlugs: ["building_materials", "retail", "fmcg"],
    faqs: [
      { q: "Can I build a report on any table in the database?", a: "No -- the report builder works over a fixed, allowlisted set of real datasets (sales, purchases, outstanding, stock) rather than arbitrary tables, so there's no risk of exposing data a role shouldn't see." },
    ],
  },
];

export function getFeatureBySlug(slug: string): FeatureContent | undefined {
  return FEATURES.find((f) => f.slug === slug);
}
