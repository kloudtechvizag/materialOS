# MASTER PRODUCT & DEVELOPMENT PROMPT

# MaterialOS — AI-Powered Building Materials Business Operating System

## 1. PRODUCT IDENTITY

Build a production-grade SaaS platform named:

**MaterialOS**

Tagline:

**AI-Powered Building Materials Business Operating System**

Position MaterialOS as a modern vertical operating system for:

* Cement dealers
* Cement distributors
* Steel/TMT dealers
* Iron merchants
* Hardware stores
* Electrical stores
* Plumbing stores
* Sanitaryware businesses
* Tiles businesses
* Paint dealers
* Construction-material distributors
* Building-material wholesalers
* Retail building-material stores
* Multi-branch material businesses

MaterialOS must NOT feel like a traditional accounting package.

It must NOT look like old desktop ERP software.

It must feel like a modern SaaS product combining:

* ERP
* POS
* Inventory Management
* Warehouse/Yard Management
* CRM
* Project/Site Management
* Sales Force Automation
* Procurement
* Dispatch & Fleet
* Delivery
* Accounting
* GST
* Business Intelligence
* AI Assistant
* Customer Portal
* Supplier Portal
* Mobile Operations
* Offline-first Field Operations

The fundamental philosophy is:

> **MaterialOS understands how a building-material business actually operates.**

---

# 2. CORE BUSINESS MODEL

Model the complete business lifecycle:

Customer
→ Lead
→ Customer
→ Project/Site
→ Requirement
→ Quotation
→ Price Approval
→ Credit Check
→ Sales Order
→ Stock Reservation
→ Picking
→ Packing/Loading
→ Vehicle Assignment
→ Dispatch
→ Delivery
→ POD
→ Invoice
→ Payment
→ Outstanding
→ Profitability
→ Customer Intelligence
→ AI Recommendations

Also support:

Supplier
→ Purchase Request
→ RFQ
→ Purchase Order
→ Goods Receipt
→ Quality Check
→ Stock
→ Supplier Invoice
→ Payment
→ Supplier Performance

---

# 3. PLATFORMS

Build MaterialOS as one unified platform supporting:

## Web

Responsive SaaS web application.

Target:

* Desktop
* Laptop
* Tablet
* Mobile browser

## Desktop

Provide installable desktop application for:

* Windows
* macOS
* Linux

Preferred technology:

* Tauri
* React
* TypeScript

Desktop must support:

* Thermal printers
* A4 printers
* Barcode scanners
* Cash drawers
* Local printing
* Weighing-scale integrations where possible
* Offline operation where practical

## Android

Build a dedicated mobile application for:

* Salespersons
* Delivery drivers
* Warehouse staff
* Owners
* Managers
* Customers

## iOS

Build equivalent iOS application.

Use either:

* React Native + Expo

or

* Flutter

Choose one consistently.

Do not create two completely different mobile architectures.

---

# 4. TECHNOLOGY STACK

Preferred architecture:

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* TanStack Query
* Zustand
* React Hook Form
* Zod
* Recharts
* Lucide icons

Do NOT build the UI using plain HTML/CSS scattered across files.

Use a consistent design system.

## Backend

Preferred:

* Python
* FastAPI
* SQLAlchemy
* PostgreSQL
* Pydantic
* Alembic

## Background Processing

* Redis
* Celery or equivalent task queue

Use background jobs for:

* WhatsApp messages
* Email
* PDF generation
* report generation
* AI processing
* document processing
* GST/e-invoice operations
* notifications
* scheduled alerts
* reconciliation
* synchronization

## Storage

Use object storage compatible with:

* AWS S3
* Azure Blob
* MinIO

Store:

* product images
* invoices
* purchase documents
* delivery documents
* POD images
* customer documents
* GST documents
* certificates
* MTC/mill certificates
* AI uploaded documents

## Search

Design for PostgreSQL full-text search initially.

Architecture must allow future integration with:

* OpenSearch
* Elasticsearch

## Deployment

Everything must be Docker-ready.

Prepare architecture for:

* Docker Compose
* Kubernetes
* AWS
* Azure
* GCP

---

# 5. MULTI-TENANT SAAS

MaterialOS must be multi-tenant from day one.

Hierarchy:

Platform
→ Tenant
→ Company
→ Branch
→ Warehouse/Yard
→ Users

Each tenant must have complete data isolation.

Support:

* multiple companies
* multiple branches
* multiple warehouses
* multiple GSTINs
* multiple business locations
* multiple financial years
* multiple currencies

Tenant configuration must control:

* branding
* logo
* invoice templates
* GST settings
* numbering
* taxes
* currencies
* price lists
* approval rules
* user roles
* WhatsApp configuration
* integrations

---

# 6. DESIGN PRINCIPLES

MaterialOS must follow these rules:

### Rule 1 — No legacy ERP UI

Avoid:

* dense old-fashioned forms
* excessive tabs
* tiny fonts
* confusing menus
* unnecessary popups
* desktop-only workflows

### Rule 2 — Action first

Every screen should make the primary action obvious.

Example:

Sales Order page:

* Create Invoice
* Reserve Stock
* Pick
* Dispatch
* Record Payment

### Rule 3 — Context everywhere

When viewing a customer, show:

* outstanding
* credit limit
* active projects
* quotations
* orders
* deliveries
* invoices
* payments
* profitability
* communication history

### Rule 4 — One-click navigation

Users should not repeatedly enter the same information.

### Rule 5 — Global search

Search everything from one command center.

Support searches such as:

"ACC 53 grade"

"Ramesh Kumar"

"site Vijayawada"

"invoice INV-2026-00124"

"steel 12mm"

"orders pending delivery"

### Rule 6 — Mobile-first field operations

Salespeople and drivers must be able to complete their work without returning to the office.

---

# 7. GLOBAL APPLICATION SHELL

Create a modern SaaS application shell.

Desktop:

Left navigation sidebar.

Top:

* Global search
* Command palette
* Notifications
* Quick Create
* Branch selector
* Warehouse selector
* Financial year
* User profile

Main content:

* Breadcrumb
* Page title
* Contextual actions
* Content area

Right-side contextual drawer where useful.

Mobile:

* Bottom navigation
* Floating quick action
* compact header
* swipe-friendly cards
* bottom sheets

---

# 8. COMMAND CENTER

Implement a global command center.

Keyboard shortcut:

`Ctrl + K`

Allow users to:

* search customers
* search products
* search invoices
* search orders
* search projects
* create quotation
* create sales order
* create invoice
* receive payment
* create purchase order
* check stock
* check outstanding
* open reports
* navigate to modules

Example:

User types:

"Create invoice for Ramesh"

MaterialOS should:

1. find customer
2. show recent orders
3. suggest products
4. show available stock
5. allow invoice creation

---

# 9. DASHBOARD

Do NOT create a generic dashboard with meaningless charts.

Dashboard must reflect the business.

## Owner Dashboard

Show:

* Today's Sales
* Today's Collections
* Outstanding Receivables
* Outstanding Payables
* Gross Margin
* Net Margin
* Cash Position
* Bank Position
* Inventory Value
* Today's Dispatches
* Pending Orders
* Low Stock
* Slow Moving Stock
* Dead Stock
* Top Customers
* Top Products
* Salesperson Performance
* Branch Performance
* Project Revenue
* AI Alerts

Include trend comparison:

Today vs yesterday

This week vs last week

This month vs last month

This year vs previous year

---

# 10. ROLE-BASED DASHBOARDS

Create separate experiences.

## Owner

Business overview.

## Sales Manager

* sales pipeline
* quotations
* orders
* salesperson performance
* margins
* collections

## Accountant

* receivables
* payables
* cash
* bank
* GST
* reconciliation
* P&L

## Warehouse Manager

* stock
* picking
* pending dispatch
* receiving
* transfers
* stock aging

## Salesperson

* today's visits
* leads
* quotations
* orders
* collections
* customer follow-ups
* route

## Driver

* assigned deliveries
* route
* customer
* quantity
* POD

## Customer

* orders
* quotations
* invoices
* payments
* outstanding
* delivery tracking

---

# 11. PRODUCT MASTER

Create an extremely powerful product master.

Each item must support:

* SKU
* Item code
* Barcode
* Product name
* Description
* Brand
* Category
* Subcategory
* Manufacturer
* HSN
* GST rate
* Unit
* Alternate units
* Purchase unit
* Sales unit
* Conversion factor
* MRP
* Cost
* Selling price
* Minimum price
* Multiple price lists
* Customer-specific price
* Supplier-specific price
* Reorder level
* Reorder quantity
* Maximum stock
* Minimum stock
* Warehouse
* Bin
* Rack
* Image
* Documents
* Active/inactive
* Tax configuration

---

# 12. DYNAMIC PARAMETERS

Product attributes must be configurable.

Do NOT hardcode every product type.

Support:

* Color
* Size
* Grade
* Diameter
* Length
* Thickness
* Weight
* Brand
* Finish
* Model
* Series
* Batch
* Heat number
* MRP
* Manufacturing date
* Expiry date

Admin should be able to define custom parameters.

Example:

Product:

TMT Steel

Parameters:

* Brand
* Grade
* Diameter
* Length
* Heat Number
* Bundle
* Weight

Another product:

Tile

Parameters:

* Brand
* Series
* Size
* Color
* Finish
* Box Quantity

---

# 13. CEMENT INVENTORY

Provide dedicated cement workflows.

Support:

* bag-based inventory
* loose inventory where applicable
* brand
* grade
* batch
* manufacturing date
* expiry/aging
* bag count
* weight
* MRP
* purchase cost
* landed cost
* selling price
* godown
* rack
* bin

Calculate:

* bags available
* bags reserved
* bags sold
* stock value
* stock aging
* batch aging
* average cost
* gross margin

Provide:

### Cement Aging Dashboard

Show:

* fresh stock
* aging stock
* old stock
* potentially slow-moving stock

AI should recommend:

> "Move 320 bags of Brand X Batch Y because the stock has remained for 43 days."

---

# 14. STEEL / TMT INVENTORY

Support detailed steel inventory.

Parameters:

* brand
* manufacturer
* grade
* diameter
* length
* piece count
* bundle
* theoretical weight
* actual weight
* kg
* metric ton
* heat number
* batch
* MTC/mill certificate
* purchase price
* landed cost
* selling price

Conversions:

Pieces
↔ Kg
↔ MT
↔ Bundle

Allow configurable conversion rules.

Example:

12mm TMT

1 piece = configurable weight

1 bundle = configurable pieces

1 MT = 1000 kg

Maintain both:

* quantity
* actual weight

---

# 15. INVENTORY ENGINE

Build a true inventory ledger.

Every inventory movement must create an immutable transaction.

Types:

* purchase
* purchase return
* sale
* sales return
* transfer
* adjustment
* damage
* wastage
* stock count
* reservation
* release
* dispatch
* receipt

Never simply overwrite stock quantity.

Stock must be derived from ledger transactions.

Support:

* available
* reserved
* committed
* damaged
* in-transit
* blocked
* free stock

Formula:

Available Stock =
On Hand - Reserved - Blocked

---

# 16. MULTI-WAREHOUSE / YARD

Support:

* warehouses
* godowns
* yards
* racks
* bins
* zones
* outdoor storage

Structure:

Branch
→ Warehouse
→ Zone
→ Rack
→ Bin

Allow stock movement:

Warehouse A
→ Warehouse B

Track:

* requested
* approved
* dispatched
* in transit
* received

---

# 17. STOCK RESERVATION

Sales orders should reserve stock.

Example:

Customer orders:

100 bags cement

MaterialOS:

On hand = 500

Reserved = 200

Available = 300

New order reserves 100.

Available becomes:

200

Support:

* manual reservation
* automatic reservation
* priority reservation
* project reservation
* customer reservation

---

# 18. STOCK COUNT

Mobile stock-count workflow.

Warehouse employee:

1. select warehouse
2. scan barcode
3. count
4. submit
5. variance calculated
6. manager approval
7. adjustment posted

Support:

* cycle counts
* blind counts
* full stock counts
* variance approval

---

# 19. PRICE ENGINE

Create a centralized pricing engine.

Pricing must support:

* MRP
* standard price
* wholesale price
* retail price
* dealer price
* contractor price
* project price
* customer-specific price
* quantity-based price
* branch price
* location-based price
* date-based price
* promotional price

Price rules:

Customer
+
Product
+
Quantity
+
Location
+
Date
+
Project
+
Payment terms

→ Final Price

---

# 20. MARGIN ENGINE

Display:

Purchase Cost

* Freight

* Loading

* Unloading

* Handling

* Other Costs

=

Landed Cost

Then:

Selling Price

* Landed Cost

=

Gross Profit

Calculate:

* gross margin %
* gross profit
* expected margin
* actual margin

Block or require approval when margin falls below threshold.

---

# 21. SALES

Sales lifecycle:

Lead
→ Opportunity
→ Quotation
→ Sales Order
→ Delivery
→ Invoice
→ Payment

Support:

* quotations
* sales orders
* delivery challans
* invoices
* credit notes
* debit notes
* sales returns

---

# 22. QUOTATIONS

Quotation should be extremely fast.

Allow:

* customer
* project
* site
* products
* quantity
* rate
* discount
* tax
* delivery charges
* freight
* validity
* payment terms
* notes

Show:

Cost
Selling Price
Margin
Margin %

before submitting.

Support:

* PDF
* WhatsApp
* email
* customer portal

---

# 23. SALES ORDER

Sales Order must show:

Customer

Project

Site

Products

Stock availability

Reserved quantity

Pending quantity

Price

Margin

Delivery requirement

Payment terms

Credit status

Approval status

---

# 24. CUSTOMER 360

Customer profile must be a complete 360-degree view.

Show:

* customer details
* GSTIN
* addresses
* contacts
* credit limit
* credit utilization
* outstanding
* overdue
* payment history
* quotations
* orders
* invoices
* returns
* projects
* sites
* deliveries
* salespersons
* communications
* profitability
* last purchase
* average order value
* purchase frequency

AI summary:

> "This customer purchased ₹18.4L in the last 12 months, has ₹2.1L overdue, and typically pays within 19 days."

---

# 25. CREDIT MANAGEMENT

Every customer should have:

* credit limit
* credit days
* available credit
* outstanding
* overdue
* overdue buckets
* risk score

A new order should automatically evaluate credit.

Example:

Customer has:

Credit Limit = ₹10L

Outstanding = ₹9.4L

New Order = ₹1.5L

MaterialOS:

**Credit limit exceeded by ₹90,000**

Require:

* approval
* advance payment
* override permission

---

# 26. CUSTOMER PROFITABILITY

Calculate customer-level profitability.

Include:

Revenue

* Product Cost
* Freight
* Discounts
* Returns
* Sales Commission
* Delivery Cost
* Other Allocated Costs

=

Customer Profit

Identify:

* most profitable customers
* low-margin customers
* high-revenue low-profit customers
* high-risk customers

---

# 27. PROJECT / SITE MANAGEMENT

This is a major MaterialOS differentiator.

A customer can have multiple projects.

Example:

Customer:
ABC Constructions

Projects:

* Apartment Project A
* Villa Project B
* Commercial Project C

Each project can contain:

* project manager
* site engineer
* contractor
* architect
* location
* expected completion
* estimated material requirements
* quotations
* orders
* deliveries
* invoices
* collections
* project profitability

---

# 28. PROJECT MATERIAL PLANNING

For every project, allow:

Required Material

Committed Material

Ordered Material

Reserved Material

Delivered Material

Remaining Material

Example:

Cement requirement:

10,000 bags

Ordered:

7,000

Delivered:

5,500

Remaining:

4,500

AI should forecast:

> "At the current consumption rate, approximately 3,200 bags will be required over the next 30 days."

---

# 29. CONTRACTOR MANAGEMENT

Support:

* contractor profile
* sites
* projects
* purchase history
* credit
* outstanding
* commission
* schemes
* referrals
* quotations
* orders

Track relationships among:

Owner

Builder

Contractor

Engineer

Architect

Mason

Dealer

Supplier

Project

Site

---

# 30. LEAD MANAGEMENT

Lead pipeline:

New
→ Contacted
→ Qualified
→ Requirement
→ Quotation
→ Negotiation
→ Won/Lost

Track:

* source
* salesperson
* expected value
* probability
* next action
* follow-up date

---

# 31. FIELD SALES APP

Salesperson mobile application.

Show:

Today's route

Today's customers

Pending follow-ups

Outstanding collections

Open quotations

Pending orders

Nearby customers

Nearby projects

Create:

* customer
* lead
* quotation
* order
* collection
* visit

Support:

* GPS
* check-in/check-out
* notes
* photos
* voice notes
* signatures

---

# 32. PROCUREMENT

Purchase lifecycle:

Requirement
→ RFQ
→ Supplier Comparison
→ Purchase Order
→ Goods Receipt
→ Quality Check
→ Supplier Invoice
→ Payment

Support:

* purchase requests
* RFQs
* supplier quotations
* purchase orders
* goods receipt
* purchase bills
* purchase returns
* landed cost

---

# 33. SUPPLIER MANAGEMENT

Supplier 360:

* supplier profile
* GSTIN
* contacts
* purchase history
* outstanding payable
* payment history
* products
* pricing
* lead time
* delivery performance
* quality issues
* returns
* supplier rating

AI:

> "Supplier A is currently 8% cheaper than Supplier B for 12mm TMT, but Supplier B has 2.4 days faster average delivery."

---

# 34. LANDED COST

Support allocation of:

* freight
* transport
* unloading
* loading
* insurance
* handling
* miscellaneous charges

Allocate by:

* quantity
* weight
* value
* percentage

Final landed cost must feed the margin engine.

---

# 35. POS

Create extremely fast POS.

Target:

Transaction completed in seconds.

Support:

* barcode scanning
* product search
* customer selection
* walk-in customer
* cash
* UPI
* card
* bank
* split payments
* credit
* cash tendered
* change due

Example:

Total = ₹3,450

Cash received = ₹5,000

Change = ₹1,550

Support thermal printers.

---

# 36. BILLING

Invoices should support:

* configurable columns
* parameterized products
* free quantity
* discount
* tax
* freight
* packing
* delivery
* multi-currency
* payment terms
* salesperson
* project
* site

Support configurable invoice templates.

---

# 37. GST / INDIAN TAX

Design GST as a configurable compliance subsystem.

Support:

* GSTIN
* CGST
* SGST
* IGST
* HSN/SAC
* tax invoices
* credit notes
* debit notes
* GST reports
* GST reconciliation
* e-invoice
* e-way bill

Do not hardcode compliance logic throughout the application.

Create a compliance abstraction layer so rules can evolve.

---

# 38. ACCOUNTING

Implement full accounting.

Support:

* chart of accounts
* journal
* cash voucher
* bank voucher
* payment
* receipt
* contra
* debit note
* credit note
* accounts receivable
* accounts payable
* general ledger
* trial balance
* balance sheet
* profit & loss
* cash flow
* cost centers

---

# 39. COST CENTERS

Allow cost centers by:

* branch
* project
* site
* department
* salesperson
* vehicle
* warehouse

This enables true profitability analysis.

---

# 40. COLLECTIONS

Create dedicated collection management.

Show:

* today's collections
* overdue invoices
* upcoming due
* customer risk
* collection targets

Salesperson can:

* record payment
* upload receipt
* add notes
* capture signature
* send receipt

---

# 41. AI COLLECTION PRIORITIZATION

AI should rank collection opportunities.

Example:

### Today's Priority Collections

1. ABC Builders — ₹4.2L — 21 days overdue
2. XYZ Traders — ₹2.1L — 14 days overdue
3. Ramesh Enterprises — ₹1.4L — due tomorrow

Explain why each is prioritized.

---

# 42. DISPATCH MANAGEMENT

Dispatch center should show:

Pending Orders

Ready to Pick

Picked

Ready to Load

Loaded

Dispatched

In Transit

Delivered

Failed Delivery

Returned

---

# 43. VEHICLE MANAGEMENT

Support:

* vehicles
* vehicle number
* type
* capacity
* driver
* helper
* ownership
* fuel
* maintenance
* documents

Track:

* trip
* load
* distance
* fuel
* delivery cost
* utilization

---

# 44. LOAD PLANNING

Given:

Orders:

Customer A — 4 MT

Customer B — 3 MT

Customer C — 2 MT

Vehicle capacity:

10 MT

MaterialOS should suggest an efficient load.

Support:

* weight
* volume
* product type
* delivery sequence
* vehicle capacity

---

# 45. DELIVERY DRIVER APP

Driver sees:

Today's deliveries

Customer

Site address

Contact

Items

Quantity

Vehicle

Route

Payment status

Delivery instructions

Driver can:

* start trip
* navigate
* call customer
* update status
* upload delivery photo
* collect signature
* capture POD
* collect payment
* report shortage/damage

---

# 46. PROOF OF DELIVERY

POD must support:

* signature
* photo
* timestamp
* GPS
* receiver name
* quantity delivered
* shortage
* damage
* notes

Generate delivery confirmation automatically.

---

# 47. WEIGHBRIDGE

Architecture must support integration with weighing systems.

Workflow:

Vehicle Arrives

→ Gross Weight

→ Loading/Unloading

→ Tare Weight

→ Net Weight

→ Delivery/Purchase Transaction

Store weighment ticket.

---

# 48. RETURNS

Support:

* sales return
* purchase return
* damaged goods
* rejected delivery
* partial return

Track reason.

Update:

* inventory
* accounting
* customer balance
* supplier balance

---

# 49. INVENTORY INTELLIGENCE

Build:

### Reorder Engine

Consider:

* minimum stock
* average consumption
* lead time
* pending orders
* safety stock

### Slow Moving

Identify products with low movement.

### Dead Stock

Identify products with no movement for configurable period.

### Stock Aging

Show inventory aging by:

* item
* batch
* warehouse
* category

---

# 50. AI DEMAND FORECASTING

Forecast:

* next 7 days
* next 30 days
* next 90 days

Use:

* historical sales
* seasonality
* open orders
* projects
* trends
* stock

Show confidence.

---

# 51. AI PRICING

AI can recommend:

* selling price
* discount
* minimum safe price
* margin
* customer-specific price

Example:

> Current cost: ₹62/kg
> Market trend: +3.2%
> Customer history: high volume
> Recommended selling price: ₹68/kg
> Expected margin: 8.8%

AI recommendations must be explainable.

---

# 52. MATERIALOS AI ASSISTANT

Create:

**MaterialOS AI**

It should be available throughout the application.

User can ask:

"How much cement did we sell last month?"

"Who owes us the most?"

"Which products have low stock?"

"What is my profit this month?"

"Show orders waiting for dispatch."

"Which customer is becoming risky?"

"Which supplier gives the best price for 12mm TMT?"

"Why did profit fall this month?"

"What should I purchase today?"

AI should query authorized business data through tools.

Never give AI unrestricted database access.

Use controlled tools/functions.

---

# 53. AI DOCUMENT READER

Allow uploading:

* purchase invoices
* supplier bills
* quotations
* delivery documents
* certificates
* spreadsheets
* PDFs
* images

AI extracts:

* supplier
* invoice number
* date
* GSTIN
* products
* quantities
* rates
* taxes
* totals

User must review extracted information before posting accounting/inventory transactions.

---

# 54. AI VOICE ORDER

Salesperson can say:

> "Create an order for Ravi Constructions: 500 bags ACC cement and 2 tons 12mm Tata TMT for the Gajuwaka site."

AI should convert speech into structured order draft.

Never directly finalize high-impact transactions without confirmation.

---

# 55. AI BUSINESS COPILOT

Provide proactive insights.

Examples:

> Sales are down 8% compared with last Tuesday.

> Cement stock may run out in 5 days.

> Customer ABC has crossed its normal payment cycle.

> Your average gross margin fell from 9.4% to 7.8%.

> 12mm TMT has increased in purchase cost by 4.2%.

> Vehicle utilization is only 51% this week.

---

# 56. COMMUNICATION CENTER

Unified communication.

Support:

* WhatsApp
* SMS
* Email
* Push notifications

Send:

* quotation
* order confirmation
* invoice
* payment receipt
* outstanding reminder
* delivery status
* POD
* daily report

Maintain communication history.

---

# 57. WHATSAPP-FIRST WORKFLOW

Where appropriate, users should be able to send:

Invoice

Quotation

Outstanding statement

Payment receipt

Delivery status

Daily sales report

Daily collection report

via WhatsApp.

Create reusable templates.

---

# 58. CUSTOMER PORTAL

Customer can log in and see:

* quotations
* orders
* invoices
* outstanding
* payments
* delivery tracking
* documents
* projects
* statements

Allow customer to:

* approve quotation
* place order
* upload PO
* request quotation
* download invoice
* make payment

---

# 59. DIGITAL CATALOGUE

Create shareable product catalogue.

Show:

* image
* product
* brand
* specifications
* availability
* price where configured

Allow customer to:

* browse
* request quote
* add items
* submit requirement

---

# 60. REPORTING ENGINE

Reports must be dynamic.

Support:

* filters
* grouping
* sorting
* saved views
* export
* scheduled reports

Reports:

### Sales

* sales summary
* sales by product
* sales by customer
* sales by salesperson
* sales by branch
* sales by project
* sales by category
* daily/monthly/yearly sales

### Inventory

* stock ledger
* stock valuation
* aging
* slow-moving
* dead stock
* stock movement
* warehouse stock
* reserved stock

### Purchase

* supplier purchases
* purchase price trends
* supplier comparison
* purchase aging

### Finance

* P&L
* balance sheet
* cash flow
* receivables
* payables
* overdue
* collection performance

### Profitability

* product
* customer
* project
* salesperson
* branch
* vehicle

---

# 61. REPORT BUILDER

Admin users can create reports visually.

Allow:

* select fields
* filters
* grouping
* calculated fields
* charts
* export

Save as reusable report.

---

# 62. NOTIFICATION CENTER

Central notification engine.

Examples:

* low stock
* overdue invoice
* credit limit exceeded
* margin below threshold
* pending approval
* delivery delayed
* purchase order pending
* stock variance
* payment received
* failed delivery

Channels:

* in-app
* push
* email
* WhatsApp
* SMS

---

# 63. APPROVAL ENGINE

Create configurable approval workflows.

Examples:

Discount > 10%

→ Sales Manager

Discount > 20%

→ Owner

Margin < 5%

→ Owner

Credit limit exceeded

→ Finance Manager

Purchase > ₹5L

→ Director

Design approvals as configurable workflows, not hardcoded rules.

---

# 64. RBAC

Implement granular role-based access control.

Roles:

* Super Admin
* Owner
* Admin
* Finance Manager
* Accountant
* Sales Manager
* Salesperson
* Purchase Manager
* Warehouse Manager
* Warehouse Staff
* Dispatcher
* Driver
* Auditor
* Customer
* Supplier

Permissions:

* view
* create
* edit
* delete
* approve
* export
* print
* payment
* price override
* discount override

Support branch and warehouse restrictions.

---

# 65. AUDIT LOG

Every important change must be audited.

Track:

* user
* timestamp
* IP/device
* action
* old value
* new value
* transaction ID

Audit:

* price changes
* invoice edits
* stock adjustments
* credit overrides
* payment changes
* master changes
* approvals

---

# 66. OFFLINE-FIRST MOBILE

Mobile application must work in weak-network environments.

Cache:

* customers
* products
* price lists
* assigned orders
* routes
* tasks

Allow offline:

* customer creation
* visit
* quotation
* order draft
* collection
* delivery update
* POD

Sync when connection returns.

Implement:

* local queue
* retry
* conflict resolution
* sync status

Never silently lose data.

---

# 67. DOCUMENT MANAGEMENT

Create centralized document storage.

Every entity can have documents.

Examples:

Customer:

* GST certificate
* PAN
* agreement

Supplier:

* GST certificate
* bank details

Steel:

* mill certificate

Purchase:

* supplier invoice

Delivery:

* POD

Project:

* PO
* drawings
* documents

---

# 68. IMPORT / EXPORT

Support:

* Excel
* CSV
* JSON

Import:

* customers
* suppliers
* products
* opening stock
* opening balances
* price lists
* transactions where supported

Provide:

1. upload
2. map columns
3. validate
4. preview
5. import
6. error report

Never import directly without validation.

---

# 69. BACKUP & RECOVERY

Implement:

* automated backups
* point-in-time recovery where infrastructure supports it
* tenant-level export
* database backup
* document backup

Provide disaster recovery documentation.

---

# 70. SECURITY

Implement:

* secure authentication
* JWT/session strategy
* refresh tokens
* MFA-ready architecture
* password hashing
* rate limiting
* tenant isolation
* encryption in transit
* encryption at rest
* secure secrets
* audit logging
* least privilege
* API authorization
* input validation

Never expose:

* database credentials
* API keys
* secrets
* service credentials

in frontend code.

---

# 71. OBSERVABILITY

Implement:

* structured logging
* error tracking
* metrics
* tracing
* health endpoints

Monitor:

* API latency
* database latency
* queue health
* failed jobs
* sync failures
* integration failures
* AI failures

---

# 72. API-FIRST

Every major operation must have APIs.

Use:

REST APIs initially.

Architecture should allow:

* webhooks
* integrations
* external applications
* mobile apps
* customer portal
* partner integrations

Provide API documentation.

---

# 73. EVENT-DRIVEN ARCHITECTURE

Important business events should generate events.

Examples:

`CustomerCreated`

`QuotationCreated`

`QuotationApproved`

`SalesOrderCreated`

`StockReserved`

`PurchaseReceived`

`InvoiceCreated`

`PaymentReceived`

`DeliveryDispatched`

`DeliveryCompleted`

`StockAdjusted`

`CreditLimitExceeded`

`LowStockDetected`

Use events for:

* notifications
* analytics
* AI
* audit
* integrations

---

# 74. DATABASE DESIGN

Use PostgreSQL.

Design normalized transactional tables.

Core entities:

Tenant

Company

Branch

Warehouse

Zone

Rack

Bin

User

Role

Permission

Customer

CustomerContact

Supplier

SupplierContact

Product

ProductVariant

ProductParameter

ProductParameterValue

Brand

Category

Unit

UnitConversion

PriceList

PriceRule

StockLedger

StockBalance

StockReservation

StockTransfer

StockCount

Batch

SerialNumber

Project

Site

Lead

Opportunity

Quotation

QuotationItem

SalesOrder

SalesOrderItem

Delivery

DeliveryItem

Vehicle

Driver

Trip

POD

Invoice

InvoiceItem

Payment

PaymentAllocation

CreditNote

DebitNote

PurchaseRequest

RFQ

SupplierQuotation

PurchaseOrder

PurchaseOrderItem

GoodsReceipt

PurchaseBill

PurchaseReturn

Expense

Journal

LedgerEntry

Tax

GSTTransaction

EInvoice

EWayBill

CostCenter

Approval

Notification

Communication

Document

AuditLog

AIConversation

AIAction

Workflow

Subscription

Plan

FeatureFlag

---

# 75. FINANCIAL YEAR

Support Indian financial years.

Example:

2026-27

Allow:

* opening balances
* closing
* carry forward
* locked periods

Prevent unauthorized modification of closed periods.

---

# 76. NUMBERING ENGINE

Configurable numbering.

Examples:

INV-2026-000001

SO-2026-000001

PO-2026-000001

QT-2026-000001

Customize per:

* company
* branch
* document type
* financial year

---

# 77. GLOBAL ENTITY TIMELINE

Every important entity should have an activity timeline.

Example customer:

10:02 AM — quotation created

10:15 AM — quotation sent via WhatsApp

11:20 AM — customer approved

11:25 AM — sales order created

12:00 PM — stock reserved

2:30 PM — vehicle dispatched

5:10 PM — delivery completed

5:20 PM — invoice generated

5:25 PM — payment received

This timeline is critical.

---

# 78. SEARCH EXPERIENCE

Global search must support fuzzy matching.

Search:

* customer
* supplier
* product
* SKU
* barcode
* invoice
* order
* quotation
* project
* site
* vehicle
* payment

Barcode scanner should instantly open product/order workflows.

---

# 79. MOBILE UX

Do not shrink desktop UI onto mobile.

Design mobile workflows separately.

Use:

* large touch targets
* cards
* bottom sheets
* swipe actions
* camera
* GPS
* voice
* barcode scanning

Prioritize:

1. Sales
2. Collection
3. Delivery
4. Stock
5. Customer
6. Tasks

---

# 80. ACCESSIBILITY

Target WCAG 2.2 AA where practical.

Support:

* keyboard navigation
* screen readers
* focus states
* accessible labels
* contrast
* scalable fonts

---

# 81. UI DESIGN SYSTEM

Create reusable components.

Examples:

* DataTable
* SmartTable
* SearchableSelect
* ProductSelector
* CustomerSelector
* PriceEditor
* QuantityEditor
* CurrencyInput
* TaxBreakdown
* StatusBadge
* KPI
* Timeline
* ActivityFeed
* ApprovalBanner
* StockAvailability
* MarginIndicator
* PaymentStatus
* EmptyState
* ErrorState
* LoadingSkeleton
* CommandPalette
* Drawer
* Modal
* MobileBottomSheet

---

# 82. DATA TABLE EXPERIENCE

Tables must support:

* sorting
* filtering
* column visibility
* resizing
* pinning
* pagination
* infinite scroll where appropriate
* export
* saved views

Do not create tables with 25 tiny columns by default.

Use:

* essential columns
* expandable details
* contextual drawer

---

# 83. PERFORMANCE

Application must feel fast.

Targets:

* initial page load optimized
* API responses generally <500ms for normal queries
* lazy loading
* pagination
* virtualized tables
* caching
* optimistic UI where safe

Never load the entire database/page just to display one section.

---

# 84. SPA BEHAVIOR

MaterialOS must feel like a true single-page application.

When users switch:

* Dashboard
* Sales
* Inventory
* Purchase
* Projects
* Accounting

do not reload the entire page.

Load only the required route/container/data.

Use:

* client-side routing
* TanStack Query
* route-level code splitting
* cached queries

Maintain:

* scroll position where appropriate
* filters
* selected tabs

---

# 85. REAL-TIME UPDATES

Use WebSockets/SSE where valuable.

Examples:

* new order
* payment received
* stock changed
* delivery status
* approval request
* driver status

Dashboard should update without full refresh.

---

# 86. SUBSCRIPTIONS

MaterialOS is SaaS.

Support:

Free Trial

Starter

Professional

Business

Enterprise

Billing:

* monthly
* yearly

Features can be plan-controlled.

Example:

Starter:

* 1 company
* 1 branch
* basic inventory

Professional:

* multi-branch
* advanced inventory
* CRM
* analytics

Business:

* AI
* field sales
* fleet
* advanced workflows

Enterprise:

* unlimited/custom
* API
* SSO
* custom integrations

Do not hardcode subscription logic into individual UI pages.

Use feature flags/entitlements.

---

# 87. ADMIN CENTER

Platform administrators need:

* tenants
* subscriptions
* usage
* billing
* feature flags
* integrations
* support
* audit
* system health

Tenant admins need:

* company
* branches
* users
* roles
* products
* taxes
* numbering
* workflows
* integrations
* branding

---

# 88. INTEGRATION ARCHITECTURE

Build integration adapters.

Possible integrations:

* WhatsApp provider
* SMS provider
* email
* payment gateway
* GST/e-invoice/e-way bill provider
* accounting systems
* barcode scanners
* printers
* weighing scales
* maps
* cloud storage
* banks
* marketplaces

Never tightly couple the core system to one vendor.

---

# 89. BUSINESS INTELLIGENCE

Create an analytics layer.

Dimensions:

* time
* customer
* product
* category
* branch
* warehouse
* salesperson
* project
* site
* supplier
* vehicle

Metrics:

* revenue
* quantity
* cost
* gross profit
* margin
* collection
* outstanding
* stock value
* inventory turnover

---

# 90. AI GOVERNANCE

AI must be:

* explainable
* permission-aware
* auditable
* optional
* safe

Every AI action should have:

* user
* prompt/request
* data accessed
* tool used
* result
* action
* timestamp

AI must NEVER silently:

* change prices
* issue refunds
* post accounting entries
* modify stock
* approve credit
* submit tax documents

without explicit authorization.

---

# 91. DEMO DATA

Create realistic demo tenant.

Example company:

**Sri Balaji Building Materials**

Branches:

* Visakhapatnam
* Vijayawada
* Hyderabad

Products:

Cement:

* UltraTech
* ACC
* Ambuja
* Ramco

Steel:

* Tata Tiscon
* JSW
* Vizag Steel

Categories:

* Cement
* TMT
* Structural Steel
* Hardware
* Plumbing
* Electrical
* Tiles
* Paint
* Sanitary

Customers:

* builders
* contractors
* retailers
* individual customers

Create:

* realistic orders
* quotations
* invoices
* payments
* outstanding
* projects
* deliveries
* vehicles
* stock

Dashboard must look alive on first login.

---

# 92. SAMPLE GOLDEN TRANSACTION

This transaction must work end-to-end.

Customer:

ABC Constructions

Project:

Green Valley Apartments

Site:

Visakhapatnam

Requirement:

500 cement bags

2 MT 12mm TMT

Flow:

Customer
→ Project
→ Quotation
→ Price Calculation
→ Margin Calculation
→ Customer Credit Check
→ Approval
→ Sales Order
→ Stock Reservation
→ Warehouse Picking
→ Vehicle Assignment
→ Loading
→ Dispatch
→ Driver App
→ Delivery
→ POD
→ Invoice
→ Payment
→ Outstanding Update
→ Accounting Entry
→ Project Profitability
→ AI Insight

No duplicate data entry.

---

# 93. CRITICAL BUSINESS RULE

The same information should never be entered twice.

Example:

Customer entered once.

Project selected once.

Order created from quotation.

Invoice generated from order.

Delivery generated from order.

Payment allocated to invoice.

Accounting generated automatically.

Inventory generated automatically.

Every transaction should maintain traceability.

---

# 94. ERROR HANDLING

Never show:

"Something went wrong."

Instead show useful errors.

Example:

"Invoice could not be created because GSTIN validation failed."

Provide:

* reason
* affected field
* action
* retry

---

# 95. EMPTY STATES

Every empty state must explain what to do.

Bad:

"No data."

Good:

"No sales orders yet."

"Create your first sales order from a quotation or start a new order."

Button:

`Create Sales Order`

---

# 96. LOADING STATES

Use skeletons instead of blank screens.

Avoid global blocking loaders.

Load sections independently.

Example:

Dashboard:

Sales KPI loads

Inventory KPI loads

Collections KPI loads

AI Insights loads

independently.

---

# 97. TESTING

Implement:

### Unit tests

Business rules.

### Integration tests

API + database.

### E2E

Critical workflows.

### Mobile tests

Core field workflows.

### Permission tests

RBAC.

### Accounting tests

Ledger integrity.

### Inventory tests

Stock ledger integrity.

### AI tests

Tool authorization and output validation.

---

# 98. REGRESSION STRATEGY

Do NOT run the complete regression suite after every tiny UI change.

During development:

* targeted tests after changes
* module-level tests
* affected workflow tests

Run full regression:

* once daily during active development
* before release
* after major architectural changes

Keep a regression dashboard showing:

* passed
* failed
* flaky
* skipped

---

# 99. CI/CD

Pipeline:

Code

→ lint

→ type check

→ unit tests

→ integration tests

→ security scan

→ build

→ container scan

→ package

→ deploy

→ smoke tests

→ E2E

Use:

* GitHub Actions
* GitLab CI
* Jenkins

Architecture should not depend on one CI provider.

---

# 100. CODE QUALITY

Enforce:

* TypeScript strict mode
* Python type checking
* linting
* formatting
* no unused code
* no duplicated business logic
* no hardcoded secrets
* no hardcoded tenant IDs
* no hardcoded pricing
* no hardcoded tax rules

---

# 101. ARCHITECTURE PRINCIPLES

Use modular architecture.

Suggested backend modules:

`auth`

`tenants`

`users`

`customers`

`suppliers`

`products`

`inventory`

`warehouse`

`sales`

`purchases`

`projects`

`dispatch`

`fleet`

`delivery`

`accounting`

`tax`

`payments`

`crm`

`notifications`

`documents`

`reports`

`ai`

`integrations`

`subscriptions`

Do not create a giant monolithic file.

---

# 102. API STRUCTURE

Example:

`/api/v1/auth`

`/api/v1/customers`

`/api/v1/products`

`/api/v1/inventory`

`/api/v1/sales`

`/api/v1/purchases`

`/api/v1/projects`

`/api/v1/deliveries`

`/api/v1/accounting`

`/api/v1/reports`

`/api/v1/ai`

Use:

* pagination
* filtering
* sorting
* validation
* authorization
* consistent errors

---

# 103. API RESPONSE STANDARD

Use predictable responses.

Example concept:

```json
{
  "data": {},
  "meta": {
    "page": 1,
    "page_size": 25,
    "total": 120
  }
}
```

Errors:

```json
{
  "error": {
    "code": "CREDIT_LIMIT_EXCEEDED",
    "message": "Customer credit limit exceeded.",
    "details": {}
  }
}
```

---

# 104. MOBILE SYNCHRONIZATION

Use:

* local database
* sync queue
* server timestamps
* client IDs
* conflict handling

Every offline-created object should initially have a local UUID.

Server reconciles it after synchronization.

---

# 105. DATABASE INTEGRITY

Critical business transactions must be atomic.

Example invoice creation:

Invoice

*

Invoice Items

*

Inventory Ledger

*

Accounting Entries

*

Tax Entries

must succeed together or rollback.

Never leave half-created transactions.

---

# 106. ACCOUNTING INTEGRITY

Accounting entries must be balanced.

For every journal:

Debit = Credit

Provide ledger traceability from:

Invoice

→ Journal

→ Ledger

→ Financial Statement

---

# 107. INVENTORY INTEGRITY

Never directly modify inventory balance without a corresponding ledger transaction.

Every stock adjustment must have:

* reason
* user
* timestamp
* warehouse
* quantity
* approval if configured

---

# 108. PRODUCT DIFFERENTIATION

MaterialOS must differentiate itself from traditional ERP systems.

The product should be built around:

### Building-material intelligence

Not generic inventory.

### Project-aware selling

Not just customer-based selling.

### Site-aware delivery

Not just invoices.

### Margin-aware pricing

Not just price lists.

### Credit-aware order processing

Not just accounts receivable.

### Vehicle-aware dispatch

Not just delivery notes.

### AI-assisted decisions

Not just reports.

### Mobile field operations

Not just desktop ERP.

### Customer portal

Not just PDFs.

---

# 109. WHAT NOT TO BUILD

Do NOT build:

* generic clone of Tally
* generic clone of BUSY
* generic clone of Zoho
* generic clone of ERPNext
* static dashboards
* fake AI buttons
* meaningless charts
* huge forms
* duplicate data-entry workflows
* page reloads between tabs
* hardcoded business rules
* hardcoded product parameters
* hardcoded GST logic
* insecure AI database access

---

# 110. DEVELOPMENT METHODOLOGY

Build vertical slices.

Do NOT build all frontend pages first and backend later.

Instead:

Feature:

Sales Order

Build:

Database
→ API
→ Business Rules
→ UI
→ Mobile
→ Permissions
→ Audit
→ Notifications
→ Tests

Then move to the next workflow.

---

# 111. IMPLEMENTATION PHASES

## PHASE 0 — FOUNDATION

Build:

* repository
* monorepo structure
* frontend
* backend
* database
* authentication
* tenant architecture
* RBAC
* design system
* CI/CD
* Docker
* logging
* migrations

---

## PHASE 1 — CORE BUSINESS

Build:

* company
* branches
* warehouses
* products
* dynamic parameters
* customers
* suppliers
* inventory
* price lists
* sales
* purchase
* POS

---

## PHASE 2 — BUILDING MATERIAL INTELLIGENCE

Build:

* cement batch/aging
* steel/TMT parameters
* weight conversions
* stock reservations
* rack/bin
* yard
* landed cost
* margin engine
* project/site
* contractor management

---

## PHASE 3 — OPERATIONS

Build:

* dispatch
* vehicles
* drivers
* trips
* delivery
* POD
* mobile field sales
* collections
* offline sync

---

## PHASE 4 — ACCOUNTING & COMPLIANCE

Build:

* ledger
* AR/AP
* P&L
* balance sheet
* cash flow
* GST
* e-invoice architecture
* e-way bill architecture
* reconciliation

---

## PHASE 5 — INTELLIGENCE

Build:

* AI assistant
* document reader
* AI pricing
* demand forecasting
* collection prioritization
* inventory intelligence
* business insights

---

## PHASE 6 — CUSTOMER ECOSYSTEM

Build:

* customer portal
* supplier portal
* digital catalogue
* online ordering
* payment integrations
* WhatsApp workflows

---

## PHASE 7 — SCALE

Build:

* advanced BI
* integrations
* enterprise RBAC
* SSO-ready architecture
* advanced APIs
* Kubernetes deployment
* observability
* enterprise security

---

# 112. ACCEPTANCE CRITERIA

The application is NOT considered complete merely because screens exist.

A module is complete only when:

* UI exists
* backend exists
* database exists
* validation exists
* authorization exists
* audit exists
* error handling exists
* loading states exist
* empty states exist
* mobile behavior exists
* API documented
* tests exist
* business workflow works end-to-end

---

# 113. UI ACCEPTANCE CRITERIA

Every screen must:

* look production-ready
* be responsive
* work on mobile
* have loading states
* have empty states
* have error states
* have success feedback
* use consistent components
* avoid unnecessary navigation
* avoid full-page reloads

---

# 114. PERFORMANCE ACCEPTANCE CRITERIA

The system must remain usable with:

* 100K+ products
* 1M+ inventory transactions
* 1M+ invoices
* multiple warehouses
* multiple branches
* thousands of customers
* concurrent users

Use proper:

* indexes
* pagination
* caching
* query optimization
* asynchronous jobs

---

# 115. FINAL PRODUCT EXPERIENCE

When a business owner logs in, MaterialOS should answer:

### "How is my business doing?"

Immediately.

It should tell them:

Sales

Collections

Profit

Cash

Outstanding

Stock

Orders

Deliveries

Projects

Customers

Suppliers

Risks

AI Recommendations

### "What needs my attention?"

Immediately.

### "What should I do next?"

Immediately.

That is the core product philosophy.

---

# 116. THE MATERIALOS NORTH STAR

Do not build MaterialOS as:

> Accounting + Inventory + CRM + POS + Reports

Build it as:

> **One connected operating system for the entire building-material business.**

The system should understand:

**WHO** bought

**WHAT** they bought

**FOR WHICH PROJECT**

**AT WHICH SITE**

**AT WHAT PRICE**

**FROM WHICH STOCK**

**FROM WHICH WAREHOUSE**

**USING WHICH VEHICLE**

**DELIVERED BY WHOM**

**WHEN**

**HOW MUCH WAS INVOICED**

**HOW MUCH WAS COLLECTED**

**HOW MUCH PROFIT WAS GENERATED**

**WHAT SHOULD HAPPEN NEXT**

That connected intelligence is the core competitive advantage of MaterialOS.

---

# 117. GOLDEN RULE FOR THE DEVELOPMENT AGENT

Whenever implementing a feature, ask:

1. Does this solve a real building-material business problem?
2. Can the user complete it with fewer steps?
3. Is the data connected to the rest of the business?
4. Does it work on web and mobile where appropriate?
5. Is it permission-aware?
6. Is it auditable?
7. Is it scalable?
8. Can AI make this workflow smarter?
9. Can the system eliminate duplicate data entry?
10. Does this make MaterialOS better than a traditional ERP?

If the answer is no, redesign the feature.

---

# FINAL OBJECTIVE

Build **MaterialOS** as a production-grade, cloud-native, AI-powered Building Materials Business Operating System.

It must be:

**Modern**
**Fast**
**Mobile-first**
**AI-powered**
**Building-material aware**
**Project-aware**
**Inventory-aware**
**Margin-aware**
**Credit-aware**
**Delivery-aware**
**Accounting-aware**
**GST-ready**
**Offline-capable**
**Multi-tenant**
**Multi-branch**
**API-first**
**Secure**
**Scalable**

The finished product should feel closer to a modern combination of:

**Shopify + Salesforce + Zoho + modern logistics software + accounting + AI**

specifically redesigned for the **Indian building-material business**.

Do not compromise on usability for feature count.

**Build a business operating system, not another ERP.**
