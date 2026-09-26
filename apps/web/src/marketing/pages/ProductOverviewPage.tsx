import { Link } from "react-router-dom";
import {
  Banknote, Bell, ClipboardList, Factory, LayoutDashboard, MousePointer2, ShieldCheck, ShoppingCart, Sparkles, Store, Target, Truck, Users, Webhook,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Seo } from "@/components/marketing/Seo";
import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { ModuleCard } from "@/components/marketing/ModuleCard";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";
import { FEATURES } from "@/marketing/content/features";
import { FEATURE_ICONS } from "@/marketing/icons";
import { paletteGradient } from "@/marketing/palette";
import { FEATURE_SCREENSHOTS, HERO_SCREENSHOTS } from "@/marketing/screenshots";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Product" }];

/** One-sentence, scannable versions of each feature's long-form
 * solutionSummary (which stays on the /features/:slug detail page).
 * Keyed locally rather than added to FeatureContent -- this is a
 * card-layout concern, not part of the feature content model. */
const CARD_TAGLINE: Record<string, string> = {
  "inventory-management": "One live stock ledger, updated on every sale, purchase, and transfer.",
  "sales-quotation-management": "Quotes become orders, dispatch, and invoices -- automatically.",
  "credit-management": "Credit limits enforced before an order is confirmed, not after.",
  pos: "A fast till connected to the same stock ledger as everything else.",
  "warehouse-dispatch-management": "Pick, pack, and dispatch -- tracked to the doorstep.",
  "serial-imei-rma-tracking": "Track every unit by serial number, from sale to return.",
  "gst-accounting-financial-reports": "GST-ready books and financial reports, always current.",
  "report-builder": "Build the exact report your business needs -- no SQL required.",
};

/** Two flagship modules get the wide bento cell; the rest of the 8 core
 * features stay standard-width. Hand-picked, not derived, so the
 * layout reads intentionally rather than following array order. */
const HERO_SLUGS = new Set(["inventory-management", "sales-quotation-management"]);

/** Real modules without a dedicated /features/:slug page yet -- name +
 * one-line description only, no dead CTA link. Every one of these is a
 * real, working route in the authenticated app today
 * (lib/navigation.ts), not an aspirational claim. */
const MORE_MODULES = [
  { icon: Target, name: "Leads & CRM pipeline", description: "Track a lead to a converted customer." },
  { icon: ShoppingCart, name: "Procurement & purchase orders", description: "Purchase orders and goods receipt feed the same stock ledger as sales." },
  { icon: Truck, name: "Field sales", description: "Rep check-ins and visit tracking on the road." },
  { icon: Banknote, name: "Collections & ageing", description: "Real-time outstanding balances, not a stale statement." },
  { icon: Factory, name: "Projects & sites", description: "Link sales and delivery to a specific site." },
  { icon: Users, name: "People & payroll", description: "Employees, attendance, leave, and payroll, unified." },
  { icon: ShieldCheck, name: "Approvals & workflow", description: "Configurable sign-off for the transactions that need it." },
  { icon: LayoutDashboard, name: "Backups, audit & operations", description: "Automated backups and a full audit trail." },
  { icon: Store, name: "Customer portal", description: "Customers approve their own quotes and invoices." },
  { icon: Webhook, name: "Webhooks & integrations", description: "Signed callbacks when an order or invoice is created." },
  { icon: ClipboardList, name: "Capability marketplace", description: "Install add-ons like Printing & Color Lab, no plan change." },
];

export function ProductOverviewPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title="Product Overview -- Everything MaterialOS Runs on One Platform"
        description="Sales, inventory, procurement, warehouse, dispatch, billing, accounting, collections, and more -- every MaterialOS module, in one place."
        path="/product"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/product")}
      />

      {/* Ambient lighting glows & mesh grid */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[950px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.25)_0%,rgba(59,130,246,0.12)_45%,transparent_75%)] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-8">
        <Breadcrumbs items={BREADCRUMB_ITEMS} />
      </div>

      {/* Hero Header */}
      <header className="relative mx-auto max-w-4xl px-6 pb-6 pt-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-300 backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-white">Unified Operating Graph</span>
          <span className="text-white/40">•</span>
          <span>Every Enterprise Module In One System</span>
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
        </div>

        <h1 className="mt-7 text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.15]">
          Every module.{" "}
          <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
            One Connected System.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-300 sm:text-xl sm:leading-relaxed">
          Sales, inventory, dispatch, billing, and accounting read and write the exact same data — never a separate sync app or manual spreadsheet export.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Button
            size="lg"
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 text-base font-semibold text-white shadow-[0_0_30px_-5px_rgba(124,58,237,0.5)] transition-all duration-300 hover:scale-[1.02] hover:from-violet-500 hover:to-indigo-500"
            asChild
          >
            <Link to="/signup">
              Start Free 14-Day Trial
              <span className="ml-2 inline-block transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-xl border-white/15 bg-white/5 px-8 py-6 text-base font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/30"
            asChild
          >
            <Link to="/book-demo">Book Architecture Walkthrough</Link>
          </Button>
        </div>
      </header>

      {/* Floating Interactive Screenshot Presentation */}
      <section className="relative mx-auto max-w-5xl px-6 pb-20 pt-8 sm:pt-12">
        <div className="relative">
          <BrowserFrame
            src={HERO_SCREENSHOTS.dashboard}
            alt="MaterialOS dashboard showing real-time ledger, outstanding receivables, stock alerts, and orders"
            className="mx-auto max-w-4xl -rotate-1 shadow-[0_30px_70px_rgba(0,0,0,0.8)] transition-transform duration-500 hover:rotate-0"
          />

          {/* Floating Live Signal Chips */}
          <div
            className="absolute -right-2 top-8 hidden items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[#0B0F19]/90 px-4 py-3 text-left shadow-[0_15px_35px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:flex sm:right-4 lg:right-0"
            aria-hidden="true"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <Bell className="h-4 w-4 text-emerald-400" />
            </span>
            <div>
              <p className="text-xs font-semibold text-white">Invoice #1042 Paid & Reconciled</p>
              <p className="text-[11px] text-zinc-400">Zero latency ledger update across branches</p>
            </div>
          </div>

          <div
            className="absolute -bottom-4 left-6 hidden items-center gap-2 rounded-xl border border-violet-500/30 bg-[#0B0F19]/90 px-3.5 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-xl sm:flex lg:left-12"
            aria-hidden="true"
          >
            <MousePointer2 className="h-3.5 w-3.5 text-violet-400" />
            <span>Sribalaji Metals & Industrial Supply</span>
          </div>
        </div>
      </section>

      {/* Connected Business Pipeline Section */}
      <section className="relative border-y border-white/10 bg-[#0B0F19]/60 py-16 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
              Live Pipeline Architecture
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Zero Data Re-Entry. Seamless Transaction Flow.
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
              Data travels automatically through each operational gate without manual intervention or batch syncs.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { step: "01", name: "Quotation", desc: "Live margin check & customer credit", icon: ClipboardList, color: "text-violet-400" },
              { step: "02", name: "Sales Order", desc: "Auto-reserves warehouse stock", icon: ShoppingCart, color: "text-sky-400" },
              { step: "03", name: "Dispatch", desc: "Digital pick-list & POD tracking", icon: Truck, color: "text-amber-400" },
              { step: "04", name: "Tax Invoice", desc: "Instant GSTN e-invoice QR code", icon: Banknote, color: "text-emerald-400" },
              { step: "05", name: "Stock Ledger", desc: "Weighted average cost calculated", icon: Factory, color: "text-indigo-400" },
              { step: "06", name: "Audit Trail", desc: "Tamper-proof digital event log", icon: ShieldCheck, color: "text-rose-400" },
            ].map((node) => (
              <div
                key={node.step}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl transition-all duration-300 hover:border-violet-500/40 hover:bg-white/[0.05]"
              >
                <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                  <span>{node.step}</span>
                  <node.icon className={`h-4 w-4 ${node.color}`} />
                </div>
                <h3 className="mt-3 font-semibold text-white">{node.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{node.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Modules Bento Grid */}
      <div className="mx-auto max-w-6xl px-6 py-24">
        <section>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Core Enterprise Modules</h2>
            <p className="mt-3 text-base text-zinc-400">The eight high-capacity foundational engines running inside every workspace.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => {
              const isHero = HERO_SLUGS.has(feature.slug);
              return (
                <ModuleCard
                  key={feature.slug}
                  to={`/features/${feature.slug}`}
                  icon={FEATURE_ICONS[feature.slug]}
                  gradient={paletteGradient(i)}
                  name={feature.name}
                  tagline={CARD_TAGLINE[feature.slug] ?? feature.solutionSummary}
                  screenshot={FEATURE_SCREENSHOTS[feature.slug]}
                  size={isHero ? "hero" : "standard"}
                  className={isHero ? "sm:col-span-2 lg:col-span-2" : undefined}
                />
              );
            })}
          </div>
        </section>

        {/* Also Included Capabilities Section */}
        <section className="mt-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
              Standard On Every Plan
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Also Built-In Out of the Box</h2>
            <p className="mt-3 text-base text-zinc-400">No nickel-and-dime add-on pricing. Real operational tools included with every workspace.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MORE_MODULES.map((module, i) => (
              <ModuleCard
                key={module.name}
                icon={module.icon}
                gradient={paletteGradient(i + 2)}
                name={module.name}
                tagline={module.description}
              />
            ))}
          </div>
        </section>

        {/* Bottom Conversion CTA */}
        <section className="relative mt-28 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0B0F19] to-[#04070E] p-10 text-center shadow-[0_20px_50px_rgba(0,0,0,0.6)] sm:p-16">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.25)_0%,transparent_70%)] blur-3xl"
            aria-hidden="true"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-300">
              Instant Workspace Provisioning
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Ready to Run on a Connected System?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-zinc-300">
              Launch your pre-configured workspace with full feature access in under 3 minutes. No credit card required.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 text-base font-semibold text-white shadow-[0_0_25px_rgba(124,58,237,0.5)] transition-all hover:scale-[1.02] hover:from-violet-500 hover:to-indigo-500"
                asChild
              >
                <Link to="/signup">Start Free 14-Day Trial</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-xl border-white/15 bg-white/5 px-8 py-6 text-base font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/30"
                asChild
              >
                <Link to="/book-demo">Schedule Live Architecture Demo</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
