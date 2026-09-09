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
      <span className="inline-flex items-center gap-1.5 text-[#047857]">
        <Check className="h-4 w-4" /> Yes
      </span>
    );
  }
  if (value === "No") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Minus className="h-4 w-4" /> No
      </span>
    );
  }
  return <span className="text-muted-foreground">{value}</span>;
}

/** Category comparison, not a named-competitor attack page: Traditional
 * Accounting Software / Traditional ERP / Multiple SaaS Tools /
 * MaterialOS. No invented statistics, reviews, or claims -- see the
 * disclaimer at the bottom of the table. */
export function ComparePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Seo
        title="MaterialOS Compared -- Accounting Software vs ERP vs One Connected System"
        description="How MaterialOS compares to traditional accounting software, traditional ERP, and stitching together multiple separate tools."
        path="/compare"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/compare")}
      />
      <Breadcrumbs items={BREADCRUMB_ITEMS} />

      <header className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">More than ERP. More than accounting.</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Traditional accounting software, traditional ERP, and a pile of disconnected SaaS tools all solve pieces of
          the problem. Here's how MaterialOS compares on the workflows that actually matter.
        </p>
      </header>

      <section className="mt-10 overflow-x-auto">
        <table className="hidden w-full text-sm sm:table">
          <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Capability</th>
              <th className="px-4 py-3 font-medium">Traditional accounting</th>
              <th className="px-4 py-3 font-medium">Traditional ERP</th>
              <th className="px-4 py-3 font-medium">Multiple SaaS tools</th>
              <th className="px-4 py-3 font-medium text-[#7C3AED]">MaterialOS</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.capability} className="border-t border-[#E2E8F0]">
                <td className="px-4 py-3 font-medium">{row.capability}</td>
                <td className="px-4 py-3"><Cell value={row.accounting} /></td>
                <td className="px-4 py-3"><Cell value={row.erp} /></td>
                <td className="px-4 py-3"><Cell value={row.tools} /></td>
                <td className="px-4 py-3 font-medium"><Cell value={row.materialos} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile: card-per-row, not a shrunk table */}
        <div className="space-y-4 sm:hidden">
          {ROWS.map((row) => (
            <div key={row.capability} className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm">
              <p className="font-medium">{row.capability}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Traditional accounting</dt><dd><Cell value={row.accounting} /></dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Traditional ERP</dt><dd><Cell value={row.erp} /></dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Multiple SaaS tools</dt><dd><Cell value={row.tools} /></dd></div>
                <div className="flex justify-between"><dt className="font-medium text-[#7C3AED]">MaterialOS</dt><dd><Cell value={row.materialos} /></dd></div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">Feature availability may vary by plan and configuration.</p>

      <section className="mt-16 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
        <h2 className="text-xl font-semibold">See it running your own business</h2>
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
