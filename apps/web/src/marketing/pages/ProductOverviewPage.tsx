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
import { FEATURE_SCREENSHOTS } from "@/marketing/screenshots";

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
    <div className="bg-[#F9FAFB]">
      <Seo
        title="Product Overview -- Everything MaterialOS Runs on One Platform"
        description="Sales, inventory, procurement, warehouse, dispatch, billing, accounting, collections, and more -- every MaterialOS module, in one place."
        path="/product"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/product")}
      />

      <div className="mx-auto max-w-6xl px-6 pt-8">
        <Breadcrumbs items={BREADCRUMB_ITEMS} />
      </div>

      {/* Hero -- centered headline, floating screenshot on a soft gradient
          field with a couple of decorative UI chips layered on top (real
          DOM elements, not baked into the screenshot itself) so it feels
          alive rather than a static picture. */}
      <header className="mx-auto max-w-4xl px-6 pb-4 pt-10 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" />
          One platform, every module
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Every module, one connected system.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Sales, inventory, dispatch, and accounting read and write the same data — never a separate app per module.{" "}
          <Link to="/why-materialos" className="font-medium text-[#7C3AED] hover:underline">See why that matters</Link>.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" asChild>
            <Link to="/signup">Start free</Link>
          </Button>
          <Button size="lg" variant="outline" className="bg-white" asChild>
            <Link to="/book-demo">Book a demo</Link>
          </Button>
        </div>
      </header>

      <section className="relative mx-auto max-w-5xl px-6 pb-20 pt-16 sm:pt-20">
        <div
          className="pointer-events-none absolute inset-x-0 -top-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_35%,rgba(124,58,237,0.14),transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative">
          <BrowserFrame
            src="/screenshots/dashboard.webp"
            alt="MaterialOS dashboard showing outstanding, invoiced, quotations, and stock in real time"
            className="mx-auto max-w-4xl -rotate-1 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.35)] transition-transform duration-500 hover:rotate-0"
          />

          <div
            className="absolute -right-2 top-10 hidden items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3.5 py-2.5 text-left shadow-[0_12px_30px_-10px_rgba(15,23,42,0.25)] sm:flex sm:right-4 lg:right-0"
            aria-hidden="true"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D1FAE5]">
              <Bell className="h-4 w-4 text-[#059669]" />
            </span>
            <div>
              <p className="text-xs font-semibold text-foreground">Invoice #1042 paid</p>
              <p className="text-[11px] text-muted-foreground">Just now -- auto-reconciled</p>
            </div>
          </div>

          <div
            className="absolute -bottom-4 left-6 hidden items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-white shadow-lg sm:flex lg:left-16"
            aria-hidden="true"
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            Sribalaji Traders
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-24">
        <section>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Core modules</h2>
            <p className="mt-2 text-muted-foreground">The eight modules every MaterialOS workspace runs on.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

        <section className="mt-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Also included</h2>
            <p className="mt-2 text-muted-foreground">No add-on pricing, no separate setup -- these ship with every workspace.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

        <section className="relative mt-24 overflow-hidden rounded-[28px] border border-black/[0.06] bg-gradient-to-br from-[#F5F3FF] to-white p-10 text-center sm:p-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.4]"
            style={{ backgroundImage: "radial-gradient(rgba(124,58,237,0.12) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
            aria-hidden="true"
          />
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Ready to see it connected?</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">Set up your workspace in minutes -- no credit card required.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" asChild>
                <Link to="/signup">Start free</Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-white" asChild>
                <Link to="/book-demo">Book a demo</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
