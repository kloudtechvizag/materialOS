import { Link } from "react-router-dom";
import { Boxes, Compass, Layers, Network, Rocket, Smartphone, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";
import { paletteColor } from "@/marketing/palette";
import { PILLAR_PHOTOS } from "@/marketing/screenshots";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Why MaterialOS" }];

const PILLAR_HIGHLIGHTS: { key: keyof typeof PILLAR_PHOTOS; label: string }[] = [
  { key: "mobile-first-field-sales", label: "Mobile-first & field sales" },
  { key: "real-time-intelligence", label: "Real-time intelligence" },
  { key: "one-business-graph", label: "One business graph" },
  { key: "connected-commerce", label: "Connected commerce" },
];

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
    <div className="relative min-h-screen overflow-hidden bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title="Why MaterialOS -- Built for How Modern Businesses Actually Operate"
        description="MaterialOS connects sales, inventory, purchasing, credit, dispatch, and accounting into one system -- instead of another app bolted onto a pile of disconnected tools."
        path="/why-materialos"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/why-materialos")}
      />

      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[550px] w-[900px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.25)_0%,rgba(59,130,246,0.12)_45%,transparent_75%)] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-8">
        <Breadcrumbs items={BREADCRUMB_ITEMS} />
      </div>

      <header className="relative mx-auto max-w-4xl px-6 pb-6 pt-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-300 backdrop-blur-md">
          <span>The Architectural Advantage • Unified Operating Graph</span>
        </div>

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.15]">
          Built for how modern businesses{" "}
          <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
            actually operate.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-300 sm:text-xl sm:leading-relaxed">
          Not another point solution bolted onto a brittle pile of spreadsheets. One synchronized system your entire company moves on.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <Button
            size="lg"
            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 font-semibold text-white shadow-[0_0_25px_rgba(124,58,237,0.4)] transition-all hover:scale-[1.02] hover:from-violet-500 hover:to-indigo-500"
            asChild
          >
            <Link to="/signup">Start Free 14-Day Trial</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-xl border-white/15 bg-white/5 px-8 py-6 font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/30"
            asChild
          >
            <Link to="/compare">Compare Alternatives</Link>
          </Button>
        </div>
      </header>

      {/* Visual Highlights Grid */}
      <section className="relative mx-auto max-w-6xl px-6 pt-12">
        <div className="grid gap-6 sm:grid-cols-2">
          {PILLAR_HIGHLIGHTS.map(({ key, label }) => (
            <div
              key={key}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 hover:border-violet-500/40"
            >
              <img
                src={PILLAR_PHOTOS[key]}
                alt={`${label} in MaterialOS`}
                className="h-60 w-full object-cover brightness-90 transition-transform duration-500 ease-out group-hover:scale-105 sm:h-72"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/40 to-transparent" />
              <p className="absolute bottom-5 left-6 text-lg font-bold text-white drop-shadow-md">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7 Core Pillars */}
      <section className="relative mx-auto max-w-6xl px-6 py-24">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
            Engineered Differently
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">The Seven Operating Pillars</h2>
          <p className="mx-auto mt-2 max-w-xl text-base text-zinc-400">
            Principles designed from day one to guarantee reliability, auditability, and speed.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => {
            const color = paletteColor(i);
            return (
              <Card
                key={pillar.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_15px_35px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:bg-white/[0.05]"
              >
                <CardContent className="p-6">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ring-1 ring-white/15"
                    style={{ backgroundColor: `${color.bg}30` }}
                  >
                    <pillar.icon className="h-7 w-7" style={{ color: color.fg }} />
                  </div>
                  <h3 className="mt-5 text-xl font-bold tracking-tight text-white">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">{pillar.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Unified Business Graph Deep Dive */}
      <section className="relative border-y border-white/10 bg-[#0B0F19]/60 py-20 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              Zero Redundancy
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              One Business Graph. Nothing Duplicated.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-zinc-300">
              Every customer and every inventory SKU is a single authoritative node connected to everything that touches it — eliminating synchronization lag forever.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {/* Customer Node */}
            <div className="rounded-2xl border border-violet-500/30 bg-white/[0.02] p-8 backdrop-blur-xl shadow-xl">
              <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg">
                <Users className="h-4 w-4" />
                <span>Customer Business Node</span>
              </div>
              <p className="mt-4 text-xs text-zinc-400">Instantly shared across all touchpoints with zero sync delay:</p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {GRAPH_EDGES.customer.map((node) => (
                  <span
                    key={node}
                    className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-semibold text-violet-300 shadow-sm"
                  >
                    {node}
                  </span>
                ))}
              </div>
            </div>

            {/* Product Node */}
            <div className="rounded-2xl border border-emerald-500/30 bg-white/[0.02] p-8 backdrop-blur-xl shadow-xl">
              <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-lg">
                <Boxes className="h-4 w-4" />
                <span>Product SKU Node</span>
              </div>
              <p className="mt-4 text-xs text-zinc-400">Instantly updated across warehouse, POS, and procurement:</p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {GRAPH_EDGES.product.map((node) => (
                  <span
                    key={node}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 shadow-sm"
                  >
                    {node}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Conversion CTA */}
      <div className="relative mx-auto max-w-5xl px-6 py-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0B0F19] to-[#04070E] p-10 text-center shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-14">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            See How MaterialOS Compares to Legacy ERPs
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-base text-zinc-300">
            Compare features, pricing transparency, and implementation velocity side by side.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-6 font-semibold text-white shadow-lg hover:from-violet-500 hover:to-indigo-500"
              asChild
            >
              <Link to="/compare">View Competitive Matrix</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-xl border-white/15 bg-white/5 px-7 py-6 font-semibold text-white backdrop-blur-md hover:bg-white/10 hover:border-white/30"
              asChild
            >
              <Link to="/product">Explore All Modules</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
