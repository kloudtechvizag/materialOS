import type { PlanOut } from "@/lib/subscription";

export interface PlanHighlight {
  id: string;
  slug: string;
  name: string;
  description: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  trialDays: number;
  popular?: boolean;
  badge?: string;
  ctaText: string;
  ctaHref: string;
  limits: {
    users: number | null;
    companies: number | null;
    branches: number | null;
    warehouses: number | null;
    invoicesPerMonth: number | null;
    customers: number | null;
    suppliers: number | null;
    items: number | null;
    storageGb: number | null;
    aiRequestsPerMonth: number | null;
  };
  features: string[];
}

export const PRICING_PLANS: PlanHighlight[] = [
  {
    id: "plan-free",
    slug: "free",
    name: "Free",
    description: "Try MaterialOS with a single company and a small team. Free forever.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    trialDays: 0,
    popular: false,
    ctaText: "Start Free",
    ctaHref: "/signup",
    limits: {
      users: 2,
      companies: 1,
      branches: 1,
      warehouses: 1,
      invoicesPerMonth: 500,
      customers: 500,
      suppliers: 100,
      items: 1000,
      storageGb: 1,
      aiRequestsPerMonth: 50,
    },
    features: [
      "Core Invoicing & Quotations",
      "Real-time Inventory Ledger",
      "GST-Compliant Tax Invoices",
      "Customer & Supplier Directory",
      "Standard Payment Recording",
      "Single-Branch Godown Stock",
    ],
  },
  {
    id: "plan-starter",
    slug: "starter",
    name: "Starter",
    description: "For small shops, retail counters, and independent traders needing fast counter billing.",
    monthlyPrice: 1499,
    yearlyPrice: 14390,
    trialDays: 14,
    popular: false,
    badge: "For Retail & Small Shops",
    ctaText: "Start 14-Day Free Trial",
    ctaHref: "/signup",
    limits: {
      users: 3,
      companies: 1,
      branches: 1,
      warehouses: 2,
      invoicesPerMonth: 2000,
      customers: 2000,
      suppliers: 500,
      items: 5000,
      storageGb: 10,
      aiRequestsPerMonth: 200,
    },
    features: [
      "Point of Sale (POS) Counter Billing",
      "Split Payments (Cash, UPI & Card)",
      "Thermal Receipt Printing (58mm & 80mm)",
      "Barcode & SKU Scanning",
      "Daily Tally XML Export",
      "Automatic E-Way Bill JSON Generation",
      "Basic AI Invoicing Assistant",
    ],
  },
  {
    id: "plan-growth",
    slug: "growth",
    name: "Growth",
    description: "For growing businesses needing multi-branch, godown transfers, and customer credit control.",
    monthlyPrice: 3999,
    yearlyPrice: 38390,
    trialDays: 14,
    popular: true,
    badge: "Most Popular",
    ctaText: "Start 14-Day Free Trial",
    ctaHref: "/signup",
    limits: {
      users: 10,
      companies: 3,
      branches: 3,
      warehouses: 5,
      invoicesPerMonth: 10000,
      customers: 10000,
      suppliers: 2000,
      items: 25000,
      storageGb: 50,
      aiRequestsPerMonth: 2000,
    },
    features: [
      "Everything in Starter, plus:",
      "Up to 3 Branches & 5 Godowns",
      "Inter-Warehouse Transfer Challans",
      "Customer Credit Limits & Approval Gates",
      "FEFO Batch Expiry & Lot Traceability",
      "Field Sales Mobile Rep Check-in",
      "Collections & Aging Dashboard",
      "Automated Hourly Cloud Backups",
      "Proactive Anomaly & Stock Alerts",
    ],
  },
  {
    id: "plan-business",
    slug: "business",
    name: "Business",
    description: "For established distributors, dealerships, and building material suppliers running dispatch and fleet.",
    monthlyPrice: 8999,
    yearlyPrice: 86390,
    trialDays: 14,
    popular: false,
    badge: "Dealers & Distributors",
    ctaText: "Start 14-Day Free Trial",
    ctaHref: "/signup",
    limits: {
      users: 25,
      companies: 10,
      branches: 10,
      warehouses: 20,
      invoicesPerMonth: 50000,
      customers: 50000,
      suppliers: 10000,
      items: 100000,
      storageGb: 250,
      aiRequestsPerMonth: 10000,
    },
    features: [
      "Everything in Growth, plus:",
      "Up to 10 Branches & 20 Godowns",
      "Live Dispatch Board & Fleet Trips",
      "Project & Site-linked Sales Orders",
      "Customer-Specific Tiered Price Lists",
      "Advanced Accounting & Cost Centers",
      "GSTR-1, 2B & 3B Statutory Filing",
      "Multi-Approval Workflow Automation",
      "REST API Access & Webhooks",
    ],
  },
  {
    id: "plan-professional",
    slug: "professional",
    name: "Professional",
    description: "For larger organizations that need advanced AI forecasting, custom dashboards, and priority SLA.",
    monthlyPrice: 17999,
    yearlyPrice: 172790,
    trialDays: 14,
    popular: false,
    badge: "Scale & Enterprise Ops",
    ctaText: "Start 14-Day Free Trial",
    ctaHref: "/signup",
    limits: {
      users: 100,
      companies: 50,
      branches: 50,
      warehouses: 100,
      invoicesPerMonth: null, // unlimited
      customers: null,
      suppliers: null,
      items: null,
      storageGb: 1000,
      aiRequestsPerMonth: 50000,
    },
    features: [
      "Everything in Business, plus:",
      "Up to 100 Users & 50 Branches",
      "Unlimited Invoices & Catalog Items",
      "AI Business Copilot & Demand Forecasting",
      "Custom Executive KPI Dashboards",
      "Advanced Row-Level Security (RLS)",
      "Tamper-Evident Audit Logging",
      "Priority 24/7 Phone & WhatsApp SLA",
      "Dedicated Onboarding Specialist",
    ],
  },
  {
    id: "plan-enterprise",
    slug: "enterprise",
    name: "Enterprise",
    description: "Custom limits, SSO/SCIM, dedicated database instances, and on-premise / private cloud VPC deployments.",
    monthlyPrice: null,
    yearlyPrice: null,
    trialDays: 0,
    popular: false,
    badge: "Custom Architecture",
    ctaText: "Schedule Enterprise Briefing",
    ctaHref: "/book-demo",
    limits: {
      users: null,
      companies: null,
      branches: null,
      warehouses: null,
      invoicesPerMonth: null,
      customers: null,
      suppliers: null,
      items: null,
      storageGb: null,
      aiRequestsPerMonth: null,
    },
    features: [
      "Unlimited Users, Branches & Companies",
      "Dedicated High-Throughput DB Cluster",
      "Single Sign-On (SAML / SSO / SCIM)",
      "On-Premise / Private Cloud VPC Hosting",
      "Custom Golden Workflows & Modules",
      "Legacy SAP / ERP Data Migration Concierge",
      "Statutory Auditor & CA Training Program",
      "Named Solutions Architect & 15-min SLA",
    ],
  },
];

export const FALLBACK_PLANS_OUT: PlanOut[] = PRICING_PLANS.map((p, idx) => ({
  id: p.id,
  slug: p.slug,
  version: 1,
  name: p.name,
  description: p.description,
  tier_order: idx,
  is_public: p.slug !== "enterprise",
  is_default_signup_plan: p.slug === "growth",
  currency: "INR",
  monthly_price: p.monthlyPrice !== null ? p.monthlyPrice.toFixed(2) : null,
  yearly_price: p.yearlyPrice !== null ? p.yearlyPrice.toFixed(2) : null,
  trial_days: p.trialDays,
  features: p.features,
  limits: {
    users: p.limits.users,
    companies: p.limits.companies,
    branches: p.limits.branches,
    warehouses: p.limits.warehouses,
    invoices_per_month: p.limits.invoicesPerMonth,
    customers: p.limits.customers,
    suppliers: p.limits.suppliers,
    items: p.limits.items,
    storage_gb: p.limits.storageGb,
    ai_requests_per_month: p.limits.aiRequestsPerMonth,
  },
}));

export interface ComparisonCategory {
  category: string;
  items: {
    name: string;
    description?: string;
    values: Record<string, string | boolean | number>;
  }[];
}

export const COMPARISON_CATEGORIES: ComparisonCategory[] = [
  {
    category: "Scale & Capacity",
    items: [
      {
        name: "Team Users Included",
        values: { free: 2, starter: 3, growth: 10, business: 25, professional: 100, enterprise: "Unlimited" },
      },
      {
        name: "Entities / Companies",
        values: { free: 1, starter: 1, growth: 3, business: 10, professional: 50, enterprise: "Unlimited" },
      },
      {
        name: "Branches & Operating Sites",
        values: { free: 1, starter: 1, growth: 3, business: 10, professional: 50, enterprise: "Unlimited" },
      },
      {
        name: "Godowns & Warehouses",
        values: { free: 1, starter: 2, growth: 5, business: 20, professional: 100, enterprise: "Unlimited" },
      },
      {
        name: "Monthly Invoices",
        values: { free: "500", starter: "2,000", growth: "10,000", business: "50,000", professional: "Unlimited", enterprise: "Unlimited" },
      },
      {
        name: "Catalog Item Capacity",
        values: { free: "1,000", starter: "5,000", growth: "25,000", business: "100,000", professional: "Unlimited", enterprise: "Unlimited" },
      },
      {
        name: "Document & Invoice Storage",
        values: { free: "1 GB", starter: "10 GB", growth: "50 GB", business: "250 GB", professional: "1,000 GB", enterprise: "Custom / TBs" },
      },
    ],
  },
  {
    category: "Billing, POS & Sales Pipeline",
    items: [
      {
        name: "GST Quotation to Invoice Flow",
        values: { free: true, starter: true, growth: true, business: true, professional: true, enterprise: true },
      },
      {
        name: "Point of Sale (POS) Counter Billing",
        values: { free: false, starter: true, growth: true, business: true, professional: true, enterprise: true },
      },
      {
        name: "Split Payments (Cash, UPI & Card)",
        values: { free: false, starter: true, growth: true, business: true, professional: true, enterprise: true },
      },
      {
        name: "Thermal Receipt Printing (58/80mm)",
        values: { free: false, starter: true, growth: true, business: true, professional: true, enterprise: true },
      },
      {
        name: "Credit Limit Pre-Check on Sales Orders",
        values: { free: false, starter: false, growth: true, business: true, professional: true, enterprise: true },
      },
      {
        name: "Customer-Specific Tiered Price Lists",
        values: { free: false, starter: false, growth: false, business: true, professional: true, enterprise: true },
      },
      {
        name: "Contractor Site & Project Linked Sales",
        values: { free: false, starter: false, growth: false, business: true, professional: true, enterprise: true },
      },
    ],
  },
  {
    category: "Inventory & Dispatch Operations",
    items: [
      {
        name: "Double-Entry Stock Ledger Movements",
        values: { free: true, starter: true, growth: true, business: true, professional: true, enterprise: true },
      },
      {
        name: "Barcode Scanning & SKU Generation",
        values: { free: false, starter: true, growth: true, business: true, professional: true, enterprise: true },
      },
      {
        name: "Inter-Godown Transfer Challans",
        values: { free: false, starter: false, growth: true, business: true, professional: true, enterprise: true },
      },
      {
        name: "Batch Number & Expiry (FEFO Picking)",
        values: { free: false, starter: false, growth: true, business: true, professional: true, enterprise: true },
      },
      {
        name: "Live Dispatch Board & Fleet Trip Tracking",
        values: { free: false, starter: false, growth: false, business: true, professional: true, enterprise: true },
      },
      {
        name: "Subcontractor RA Billing & BOQ Controls",
        values: { free: false, starter: false, growth: false, business: true, professional: true, enterprise: true },
      },
    ],
  },
  {
    category: "AI, Analytics & Integrations",
    items: [
      {
        name: "AI Business Assistant (Queries & Drafting)",
        values: { free: "50 req/mo", starter: "200 req/mo", growth: "2,000 req/mo", business: "10,000 req/mo", professional: "50,000 req/mo", enterprise: "Unlimited" },
      },
      {
        name: "AI Demand Forecasting & Reorder Points",
        values: { free: false, starter: false, growth: false, business: false, professional: true, enterprise: true },
      },
      {
        name: "Daily Tally XML Export",
        values: { free: true, starter: true, growth: true, business: true, professional: true, enterprise: true },
      },
      {
        name: "REST API Access & Webhook Subscriptions",
        values: { free: false, starter: false, growth: "Basic", business: "50k req/mo", professional: "500k req/mo", enterprise: "Custom High-Rate" },
      },
      {
        name: "Single Sign-On (SAML / SSO / SCIM)",
        values: { free: false, starter: false, growth: false, business: false, professional: false, enterprise: true },
      },
      {
        name: "Support SLA",
        values: { free: "Community", starter: "Email Support", growth: "Priority Email & Chat", growth2: "24/7 Priority", business: "Priority Phone", professional: "24/7 Phone & WhatsApp", enterprise: "Named Architect (15 min)" },
      },
    ],
  },
];

export const ADDON_PACKS = [
  {
    code: "addon.printing_pack",
    name: "Printing Press & Digital Color Lab Pack",
    category: "Industry Pack",
    description: "Production board, job ticket tracking, machine counter reconciliations, and substrate inventory.",
    monthlyPrice: 1999,
    yearlyPrice: 19190,
  },
  {
    code: "addon.school_pack",
    name: "School & Academy ERP Pack",
    category: "Industry Pack",
    description: "Student 360, guardian portal, fee invoicing with auto-split, timetable scheduler, and report cards.",
    monthlyPrice: 2499,
    yearlyPrice: 23990,
  },
  {
    code: "addon.construction_pack",
    name: "Construction EPC & BOQ Engine",
    category: "Industry Pack",
    description: "Multi-level BOQ locks, joint measurement sheets (JMS), subcontractor RA bills, and daily site DPR.",
    monthlyPrice: 2999,
    yearlyPrice: 28790,
  },
  {
    code: "addon.extra_users",
    name: "Extra Team Users (+5 Users)",
    category: "Capacity Pack",
    description: "Expand team access with granular role-based permissions and activity audit logging.",
    monthlyPrice: 999,
    yearlyPrice: 9590,
  },
  {
    code: "addon.storage_pack",
    name: "High-Capacity Cloud Storage (+100 GB)",
    category: "Capacity Pack",
    description: "Store signed delivery challans, GST e-invoices, student documents, and material test certificates.",
    monthlyPrice: 499,
    yearlyPrice: 4790,
  },
];
