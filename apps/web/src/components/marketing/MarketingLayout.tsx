import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  Database,
  ArrowRight,
  Sparkles,
  Calendar,
  CheckCircle2,
  Mail,
  FileCheck2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { isDesktopApp } from "@/lib/desktopWindow";
import { DesktopWindowControls } from "@/components/layout/DesktopWindowControls";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

type LegalModalType = "privacy" | "terms" | "security" | null;

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);
  const isTauri = isDesktopApp();

  return (
    <div className="flex min-h-screen flex-col bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      {isTauri && (
        <div
          data-tauri-drag-region
          className="flex h-9 shrink-0 items-center justify-between border-b border-white/10 bg-[#04070E] px-3 select-none text-xs text-zinc-400 z-50"
        >
          <div className="flex items-center gap-2 no-drag">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-medium text-violet-400 hover:text-violet-300 transition-colors"
            >
              <span>← Return to Workstation Launchpad</span>
            </Link>
          </div>
          <div className="no-drag">
            <DesktopWindowControls />
          </div>
        </div>
      )}
      <MarketingHeader theme="dark" />

      <main className="flex-1">{children}</main>

      {/* Modern High-End Footer */}
      <footer className="relative border-t border-white/10 bg-[#04070E] text-zinc-400 transition-colors">
        {/* Subtle Ambient Radial Glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-violet-600/[0.04] to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-12">
          {/* Pre-Footer Action Banner */}
          <div className="mb-16 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-950/30 via-zinc-900/40 to-[#070B14] p-8 shadow-2xl backdrop-blur-xl md:p-10">
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
              <div className="max-w-2xl space-y-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  <span>Next-Generation Enterprise OS</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Unify operations across your entire business
                </h2>
                <p className="text-sm leading-relaxed text-zinc-400">
                  From multi-branch inventory and thermal counter billing to automated GST compliance and credit ledgers — get started with MaterialOS in minutes.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-1.5 text-xs text-zinc-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 14-day free trial
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Zero credit card needed
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Instant Tally & Excel import
                  </span>
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Button
                  size="lg"
                  className="h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 font-semibold text-white shadow-lg shadow-violet-600/30 transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-600/50"
                  asChild
                >
                  <Link to="/signup" className="flex items-center gap-2">
                    <span>Start Free Trial</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 rounded-xl border-white/15 bg-white/[0.04] px-6 font-medium text-white hover:border-white/30 hover:bg-white/[0.08]"
                  asChild
                >
                  <Link to="/book-demo" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-violet-400" />
                    <span>Book a Live Demo</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Primary Navigation Grid */}
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12">
            {/* Brand Column (Col span 4) */}
            <div className="space-y-4 lg:col-span-4">
              <div className="flex items-center gap-2.5">
                <img src="/brand/symbol.svg" alt="MaterialOS Logo" className="h-8 w-8" />
                <span className="text-xl font-bold tracking-tight text-white">
                  Material<span className="bg-gradient-to-r from-violet-400 to-sky-400 bg-clip-text text-transparent">OS</span>
                </span>
                <span className="ml-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                  Enterprise
                </span>
              </div>

              <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
                The intelligent business operating system unifying ERP, real-time inventory ledgers, counter POS billing, and statutory GST compliance across 26 modern industries.
              </p>

              {/* Live System Status Beacon */}
              <div className="pt-2">
                <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span>All Systems Operational</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400 font-mono text-[11px]">99.99% Uptime</span>
                </div>
              </div>

              {/* Data Localization Badge */}
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="text-sm">🇮🇳</span>
                <span>Data Stored Locally in AWS Mumbai (ap-south-1)</span>
              </div>

              {/* Assisted Migration Help */}
              <div className="border-t border-white/5 pt-3">
                <p className="text-xs text-zinc-500">Migrating from Tally, Marg, or Busy?</p>
                <Link
                  to="/contact"
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-violet-400 transition-colors hover:text-violet-300"
                >
                  <span>Talk with an ERP Migration Specialist</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Column 1: Product & Features (Col span 2) */}
            <div className="space-y-3 lg:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Product
              </h3>
              <ul className="space-y-2.5 text-sm text-zinc-400">
                <li>
                  <Link to="/product" className="transition-colors hover:text-white">
                    Product Overview
                  </Link>
                </li>
                <li>
                  <Link to="/industries" className="transition-colors hover:text-white">
                    26 Industry Profiles
                  </Link>
                </li>
                <li>
                  <Link to="/features/inventory-management" className="transition-colors hover:text-white">
                    Inventory & FEFO Ledger
                  </Link>
                </li>
                <li>
                  <Link to="/features/pos" className="transition-colors hover:text-white">
                    POS & Counter Billing
                  </Link>
                </li>
                <li>
                  <Link to="/features/gst-accounting-financial-reports" className="transition-colors hover:text-white">
                    GST & E-Invoicing
                  </Link>
                </li>
                <li>
                  <Link to="/features/warehouse-dispatch-management" className="transition-colors hover:text-white">
                    Warehouse & Dispatch
                  </Link>
                </li>
                <li>
                  <Link to="/pricing" className="transition-colors hover:text-white font-medium text-violet-400 hover:text-violet-300">
                    Pricing & Plans
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: Industry Solutions (Col span 2) */}
            <div className="space-y-3 lg:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Solutions
              </h3>
              <ul className="space-y-2.5 text-sm text-zinc-400">
                <li>
                  <Link to="/industries/building_materials" className="transition-colors hover:text-white">
                    Building Materials & Steel
                  </Link>
                </li>
                <li>
                  <Link to="/industries/retail" className="transition-colors hover:text-white">
                    Retail & Supermarkets
                  </Link>
                </li>
                <li>
                  <Link to="/industries/pharmacy" className="transition-colors hover:text-white">
                    Pharmacy & Healthcare
                  </Link>
                </li>
                <li>
                  <Link to="/industries/mobile" className="transition-colors hover:text-white">
                    Mobile & Electronics
                  </Link>
                </li>
                <li>
                  <Link to="/industries/printing_press" className="transition-colors hover:text-white">
                    Printing & Color Labs
                  </Link>
                </li>
                <li>
                  <Link to="/industries/construction_contractor" className="transition-colors hover:text-white">
                    Civil Contractors
                  </Link>
                </li>
                <li>
                  <Link to="/industries" className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300">
                    <span>View all 26 verticals</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Platform & Access (Col span 2) */}
            <div className="space-y-3 lg:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Platform
              </h3>
              <ul className="space-y-2.5 text-sm text-zinc-400">
                <li>
                  <Link to="/why-materialos" className="transition-colors hover:text-white">
                    Why MaterialOS
                  </Link>
                </li>
                <li>
                  <Link to="/compare" className="transition-colors hover:text-white">
                    Compare Alternatives
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="transition-colors hover:text-white">
                    Tenant Sign In
                  </Link>
                </li>
                <li>
                  <Link to="/signup" className="transition-colors hover:text-white">
                    Start 14-Day Trial
                  </Link>
                </li>
                <li>
                  <Link to="/portal/login" className="transition-colors hover:text-white">
                    Customer Portal
                  </Link>
                </li>
                <li>
                  <Link to="/guardian/login" className="transition-colors hover:text-white">
                    Parent & Guardian Portal
                  </Link>
                </li>
                <li>
                  <Link to="/platform/login" className="transition-colors hover:text-white">
                    Platform Admin
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Company & Trust (Col span 2) */}
            <div className="space-y-3 lg:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Company & Trust
              </h3>
              <ul className="space-y-2.5 text-sm text-zinc-400">
                <li>
                  <Link to="/about" className="transition-colors hover:text-white">
                    About MaterialOS
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="transition-colors hover:text-white">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link to="/book-demo" className="transition-colors hover:text-white">
                    Book a Live Demo
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModal("security")}
                    className="text-left transition-colors hover:text-white"
                  >
                    Security Architecture
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModal("privacy")}
                    className="text-left transition-colors hover:text-white"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalModal("terms")}
                    className="text-left transition-colors hover:text-white"
                  >
                    Terms of Service
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Compliance & Security Strip */}
          <div className="mt-14 border-t border-white/10 pt-8">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-zinc-300">
                <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-white">ISO 27001:2022</div>
                  <div className="text-[11px] text-zinc-400">Certified Security Controls</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-zinc-300">
                <Lock className="h-5 w-5 text-sky-400 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-white">SOC 2 Type II</div>
                  <div className="text-[11px] text-zinc-400">Audited Trust & Privacy</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-zinc-300">
                <FileCheck2 className="h-5 w-5 text-violet-400 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-white">GST Statutory Ready</div>
                  <div className="text-[11px] text-zinc-400">Direct NIC & IRP APIs</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-zinc-300">
                <Database className="h-5 w-5 text-amber-400 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-white">PostgreSQL RLS</div>
                  <div className="text-[11px] text-zinc-400">Strict Tenant Data Isolation</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Footer: Copyright, Legal Links, Social */}
          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-zinc-500 md:flex-row">
            <div>
              &copy; {new Date().getFullYear()} MaterialOS Inc. All rights reserved. • ISO 27001 & SOC 2 Type II Certified
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
              <button
                type="button"
                onClick={() => setLegalModal("privacy")}
                className="transition-colors hover:text-white"
              >
                Privacy
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setLegalModal("terms")}
                className="transition-colors hover:text-white"
              >
                Terms
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setLegalModal("security")}
                className="transition-colors hover:text-white"
              >
                Security
              </button>
              <span>•</span>
              <Link to="/contact" className="transition-colors hover:text-white">
                Support
              </Link>
            </div>

            {/* Social / Direct Connect Links */}
            <div className="flex items-center gap-3 text-zinc-400">
              <a
                href="https://github.com/kloudtechvizag/materialOS"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-1.5 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="GitHub Repository"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
              <a
                href="mailto:contact@materialos.in"
                className="rounded-lg p-1.5 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Email MaterialOS"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Interactive Legal & Security Modals */}
      <Dialog open={legalModal !== null} onOpenChange={(open) => !open && setLegalModal(null)}>
        <DialogContent className="max-w-xl border-white/10 bg-[#0B0F19] text-white">
          {legalModal === "privacy" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  <span>Privacy Policy & Data Sovereignty</span>
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Last updated: 2026. MaterialOS respects your organizational data privacy.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-xs leading-relaxed text-zinc-300">
                <p>
                  <strong>1. Data Ownership:</strong> All tenant data, customer records, invoices, stock movements, and financial ledgers created within MaterialOS belong solely to your organization. MaterialOS never sells, rents, or monetizes customer data.
                </p>
                <p>
                  <strong>2. Indian Data Residency:</strong> All primary databases and backup archives reside exclusively in Indian cloud infrastructure (AWS ap-south-1 Mumbai) in strict compliance with MeitY data localization mandates.
                </p>
                <p>
                  <strong>3. Encryption:</strong> All data is encrypted in transit using TLS 1.3 and at rest with AES-256 standard encryption. Multi-tenant access is enforced using PostgreSQL Row-Level Security (RLS).
                </p>
                <p>
                  <strong>4. Data Portability:</strong> You can export full company ledgers, inventory tables, and customer records at any time in CSV, Excel, or JSON formats without vendor lock-in.
                </p>
              </div>
            </>
          )}

          {legalModal === "terms" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <FileCheck2 className="h-5 w-5 text-violet-400" />
                  <span>Terms of Service & SLA</span>
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Standard enterprise subscription and platform terms.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-xs leading-relaxed text-zinc-300">
                <p>
                  <strong>1. Service Availability:</strong> MaterialOS targets a 99.99% service level agreement (SLA) for core invoice generation, POS billing, and stock ledger movements.
                </p>
                <p>
                  <strong>2. Subscription & Billing:</strong> Subscriptions are billed in Indian Rupees (INR) with standard CGST, SGST, or IGST tax breakdowns. Upgrades apply immediately; downgrades are validated against usage limits to protect ledger integrity.
                </p>
                <p>
                  <strong>3. Trial Grace Period:</strong> Following the 14-day free trial, existing records remain read-accessible and secure during the grace period while you select a plan. No records are deleted.
                </p>
                <p>
                  <strong>4. Fair Usage:</strong> Unlimited invoicing and stock operations are subject to standard automated bot and fraud prevention policies.
                </p>
              </div>
            </>
          )}

          {legalModal === "security" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <Lock className="h-5 w-5 text-sky-400" />
                  <span>Security & Isolation Architecture</span>
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Built on enterprise-grade isolation and zero-trust principles.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-xs leading-relaxed text-zinc-300">
                <p>
                  <strong>1. Row-Level Security (RLS):</strong> MaterialOS enforces tenant boundary separation directly at the database engine level via PostgreSQL Row-Level Security policies, guaranteeing zero data bleed across tenant schemas.
                </p>
                <p>
                  <strong>2. Statutory GST Direct API:</strong> Direct integration with GST NIC and IRP government portals ensures tamper-evident IRN hashing, QR code generation, and E-Way bill synchronization.
                </p>
                <p>
                  <strong>3. Automated Backups:</strong> Immutable point-in-time recovery archives ensure business continuity even during catastrophic network outages.
                </p>
                <p>
                  <strong>4. SOC 2 Type II & ISO 27001:2022:</strong> Our physical and digital infrastructure undergoes continuous automated compliance audits and annual third-party penetration testing.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
