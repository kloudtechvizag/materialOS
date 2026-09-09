import { Link } from "react-router-dom";
import { Boxes, Compass, Layers, Network, Rocket, Smartphone, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";
import { paletteColor } from "@/marketing/palette";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Why MaterialOS" }];

const PILLARS = [
  {
    icon: Network,
    title: "Connected",
    description:
      "A quotation, a sales order, an invoice, and a receipt aren't three separate records re-typed by hand -- they're the same data carried forward, so stock, credit, and accounting are never out of sync with what actually happened.",
  },
  {
    icon: Compass,
    title: "Industry-aware",
    description:
      "MaterialOS adapts to the business instead of forcing every business into the same workflow -- terminology, enabled modules, and dashboard widgets are driven by a real industry profile, not a one-size-fits-all screen.",
  },
  {
    icon: Layers,
    title: "Capability-driven",
    description:
      "Start with what you need. Add-ons like the Printing & Digital Color Lab pack or extra users attach to any plan without moving you to a bigger tier or replacing the platform.",
  },
  {
    icon: Smartphone,
    title: "Mobile-first",
    description: "A real desktop app for Windows, macOS, and Linux alongside the web application -- run the business from wherever it actually happens.",
  },
  {
    icon: Boxes,
    title: "Omnichannel",
    description: "Counter POS, warehouse dispatch, field sales, and a customer-facing portal all read and write the same stock, pricing, and customer records -- not separate silos.",
  },
  {
    icon: Rocket,
    title: "Built for growth",
    description: "Add users, branches, warehouses, and capabilities as the business grows, without a re-implementation project or a second system.",
  },
  {
    icon: Users,
    title: "Real-time intelligence",
    description: "A command center surfaces outstanding payments, low stock, and pending approvals as they happen -- not in a report you have to remember to run.",
  },
];

const GRAPH_EDGES = {
  customer: ["Orders", "Quotes", "Invoices", "Payments", "Credit"],
  product: ["Inventory", "Purchases", "Sales", "Suppliers", "Pricing"],
};

export function WhyMaterialOSPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Seo
        title="Why MaterialOS -- Built for How Modern Businesses Actually Operate"
        description="MaterialOS connects sales, inventory, purchasing, credit, dispatch, and accounting into one system -- instead of another app bolted onto a pile of disconnected tools."
        path="/why-materialos"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/why-materialos")}
      />
      <Breadcrumbs items={BREADCRUMB_ITEMS} />

      <header className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">Built for how modern businesses actually operate.</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Not another app bolted onto a pile of disconnected tools. One connected system your whole business runs on.
        </p>
      </header>

      <section className="mt-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => {
            const color = paletteColor(i);
            return (
              <Card key={pillar.title} className="border-[#E2E8F0]">
                <CardContent className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: color.bg }}>
                    <pillar.icon className="h-5 w-5" style={{ color: color.fg }} />
                  </div>
                  <h2 className="mt-4 font-semibold">{pillar.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{pillar.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold">One business graph. Nothing duplicated.</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every customer and every product is a single record connected to everything that touches it -- not a copy
          re-entered in a second system.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
            <div className="inline-block rounded-full bg-[#7C3AED] px-4 py-1.5 text-sm font-semibold text-white">Customer</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {GRAPH_EDGES.customer.map((node) => (
                <span key={node} className="rounded-full border border-[#DDD6FE] bg-white px-3 py-1 text-xs font-medium text-[#6D28D9]">
                  {node}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
            <div className="inline-block rounded-full bg-[#10B981] px-4 py-1.5 text-sm font-semibold text-white">Product</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {GRAPH_EDGES.product.map((node) => (
                <span key={node} className="rounded-full border border-[#A7F3D0] bg-white px-3 py-1 text-xs font-medium text-[#047857]">
                  {node}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
        <h2 className="text-xl font-semibold">See how MaterialOS compares</h2>
        <p className="mt-2 text-muted-foreground">Understand the difference between MaterialOS, traditional ERP, and stitching together separate tools.</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" asChild>
            <Link to="/compare">Compare categories</Link>
          </Button>
          <Button className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" asChild>
            <Link to="/product">Explore the product</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
