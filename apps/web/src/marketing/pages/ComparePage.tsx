import { Link } from "react-router-dom";
import { Check, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Compare" }];

interface CompareRow {
  capability: string;
  accounting: string;
  erp: string;
  tools: string;
  materialos: string;
}

const ROWS: CompareRow[] = [
  { capability: "Accounting", accounting: "Yes", erp: "Yes", tools: "Partial", materialos: "Yes" },
  { capability: "Inventory", accounting: "Basic, varies", erp: "Yes", tools: "Fragmented", materialos: "Yes" },
  { capability: "CRM / customer credit", accounting: "Limited", erp: "Varies", tools: "Separate tool", materialos: "Yes" },
  { capability: "Sales & quotations", accounting: "Basic", erp: "Yes", tools: "Separate tool", materialos: "Yes" },
  { capability: "Warehouse & dispatch", accounting: "Limited", erp: "Yes", tools: "Separate tool", materialos: "Yes" },
  { capability: "Collections & ageing", accounting: "Basic", erp: "Varies", tools: "Separate tool", materialos: "Yes" },
  { capability: "Industry-specific workflows", accounting: "Limited", erp: "Varies", tools: "No", materialos: "Yes" },
  { capability: "Add capabilities without re-implementing", accounting: "Rare", erp: "Limited", tools: "No", materialos: "Yes" },
  { capability: "One connected record per customer/product", accounting: "Limited", erp: "Partial", tools: "No", materialos: "Yes" },
  { capability: "Mobile access", accounting: "Varies", erp: "Varies", tools: "Yes", materialos: "Yes" },
  { capability: "Real-time command center", accounting: "Limited", erp: "Varies", tools: "Fragmented", materialos: "Yes" },
];

function Cell({ value }: { value: string }) {
  if (value === "Yes") {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
          <Check className="h-3 w-3 text-emerald-400" />
        </span>
        Yes
      </span>
    );
  }
  if (value === "No") {
    return (
      <span className="inline-flex items-center gap-1.5 text-zinc-500">
        <Minus className="h-3.5 w-3.5" /> No
      </span>
    );
  }
  return <span className="text-zinc-400 text-xs font-medium">{value}</span>;
}

export function ComparePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title="MaterialOS Compared -- Accounting Software vs ERP vs One Connected System"
        description="How MaterialOS compares to traditional accounting software, traditional ERP, and stitching together multiple separate tools."
        path="/compare"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/compare")}
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
          <span>Architectural Comparison • The Unified System Benchmark</span>
        </div>

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.15]">
          More than ERP.{" "}
          <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
            More than Accounting.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-300 sm:text-xl sm:leading-relaxed">
          Traditional accounting programs, legacy ERPs, and fragmented point tools leave critical operational gaps. Here is how MaterialOS delivers a unified business graph.
        </p>
      </header>

      {/* High-Tech Comparison Matrix */}
      <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-6">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="hidden w-full text-sm sm:table">
              <thead className="border-b border-white/10 bg-white/[0.03] text-left">
                <tr>
                  <th className="px-5 py-4 font-semibold text-zinc-300">Core Capability</th>
                  <th className="px-5 py-4 font-medium text-zinc-400">Legacy Accounting</th>
                  <th className="px-5 py-4 font-medium text-zinc-400">Traditional ERP</th>
                  <th className="px-5 py-4 font-medium text-zinc-400">Multiple SaaS Tools</th>
                  <th className="border-x border-violet-500/30 bg-violet-500/10 px-5 py-4 font-bold text-violet-300 shadow-inner">
                    MaterialOS
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.capability} className="border-t border-white/5 transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-medium text-white">{row.capability}</td>
                    <td className="px-5 py-3.5"><Cell value={row.accounting} /></td>
                    <td className="px-5 py-3.5"><Cell value={row.erp} /></td>
                    <td className="px-5 py-3.5"><Cell value={row.tools} /></td>
                    <td className="border-x border-violet-500/30 bg-violet-500/[0.06] px-5 py-3.5 font-semibold">
                      <Cell value={row.materialos} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile responsive cards */}
          <div className="space-y-4 p-4 sm:hidden">
            {ROWS.map((row) => (
              <div key={row.capability} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-md">
                <p className="font-bold text-white">{row.capability}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <dt className="text-zinc-400">Traditional accounting</dt>
                    <dd><Cell value={row.accounting} /></dd>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <dt className="text-zinc-400">Traditional ERP</dt>
                    <dd><Cell value={row.erp} /></dd>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <dt className="text-zinc-400">Multiple SaaS tools</dt>
                    <dd><Cell value={row.tools} /></dd>
                  </div>
                  <div className="flex justify-between pt-1">
                    <dt className="font-bold text-violet-400">MaterialOS</dt>
                    <dd><Cell value={row.materialos} /></dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          * Architectural comparison based on standard out-of-the-box configurations without custom scripting.
        </p>

        {/* Bottom Conversion CTA */}
        <section className="mt-16 rounded-3xl border border-white/10 bg-gradient-to-br from-[#0B0F19] to-[#04070E] p-10 text-center shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-14">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            See the Difference in Action
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-base text-zinc-300">
            Spin up a seeded demo company with sample inventory and transactions. Fully functional in under 3 minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 font-semibold text-white shadow-lg hover:from-violet-500 hover:to-indigo-500"
              asChild
            >
              <Link to="/signup">Start Free 14-Day Trial</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-xl border-white/15 bg-white/5 px-8 py-6 font-semibold text-white backdrop-blur-md hover:bg-white/10 hover:border-white/30"
              asChild
            >
              <Link to="/book-demo">Schedule Live Demo</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
