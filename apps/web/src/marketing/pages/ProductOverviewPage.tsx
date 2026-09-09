import { Link } from "react-router-dom";
import {
  Banknote, ClipboardList, Factory, LayoutDashboard, ShieldCheck, ShoppingCart, Store, Target, Truck, Users, Webhook,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/marketing/Seo";
import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";
import { FEATURES } from "@/marketing/content/features";
import { FEATURE_ICONS } from "@/marketing/icons";
import { paletteColor } from "@/marketing/palette";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Product" }];

/** Real modules without a dedicated /features/:slug page yet -- name +
 * one-line description only, no dead CTA link. Every one of these is a
 * real, working route in the authenticated app today
 * (lib/navigation.ts), not an aspirational claim. */
const MORE_MODULES = [
  { icon: Target, name: "Leads & CRM pipeline", description: "Track a lead from first contact through to a real converted customer." },
  { icon: ShoppingCart, name: "Procurement & purchase orders", description: "Purchase orders, goods receipt, and supplier bills feed the same stock ledger as sales." },
  { icon: Truck, name: "Field sales", description: "Rep check-ins and visit tracking for teams selling outside the office." },
  { icon: Banknote, name: "Collections & ageing", description: "Real-time outstanding balances, not a stale end-of-month statement." },
  { icon: Factory, name: "Projects & sites", description: "Link sales and delivery to a specific project or construction site." },
  { icon: Users, name: "People & payroll", description: "Employees, attendance, leave, and payroll in the same platform as the rest of the business." },
  { icon: ShieldCheck, name: "Approvals & workflow", description: "Configurable approval rules for the transactions that need sign-off." },
  { icon: LayoutDashboard, name: "Backups, audit & operations", description: "Automated backups and a full audit trail of who changed what." },
  { icon: Store, name: "Customer portal", description: "Customers view and approve their own quotations, invoices, and deliveries." },
  { icon: Webhook, name: "Webhooks & integrations", description: "Signed HTTP callbacks when a sales order or invoice is created, for connecting your own tools." },
  { icon: ClipboardList, name: "Capability marketplace", description: "Install add-on capabilities like the Printing & Digital Color Lab pack without changing plans." },
];

export function ProductOverviewPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Seo
        title="Product Overview -- Everything MaterialOS Runs on One Platform"
        description="Sales, inventory, procurement, warehouse, dispatch, billing, accounting, collections, and more -- every MaterialOS module, in one place."
        path="/product"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/product")}
      />
      <Breadcrumbs items={BREADCRUMB_ITEMS} />

      <header className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">One connected system, module by module.</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Every module below reads and writes the same customer, product, and financial data -- not a separate app
          wearing the same logo.{" "}
          <Link to="/why-materialos" className="font-medium text-[#7C3AED] hover:underline">Why that matters</Link>.
        </p>
      </header>

      <section className="mt-10">
        <BrowserFrame src="/screenshots/dashboard.webp" alt="MaterialOS dashboard" />
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold">Core modules</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = FEATURE_ICONS[feature.slug];
            const color = paletteColor(i);
            return (
              <Link key={feature.slug} to={`/features/${feature.slug}`}>
                <Card className="h-full border-[#E2E8F0] transition-shadow hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: color.bg }}>
                      <Icon className="h-5 w-5" style={{ color: color.fg }} />
                    </div>
                    <h3 className="mt-4 font-semibold">{feature.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{feature.solutionSummary}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold">Also included</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MORE_MODULES.map((module, i) => {
            const color = paletteColor(i + 3);
            return (
              <div key={module.name} className="rounded-lg border border-[#E2E8F0] bg-white p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: color.bg }}>
                  <module.icon className="h-5 w-5" style={{ color: color.fg }} />
                </div>
                <h3 className="mt-3 text-sm font-semibold">{module.name}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{module.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-16 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
        <h2 className="text-xl font-semibold">Ready to see it connected?</h2>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" asChild>
            <Link to="/signup">Start free</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/book-demo">Book a demo</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
