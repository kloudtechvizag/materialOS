import { ShieldCheck, Cpu, Monitor, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "About" }];

export function AboutPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title="About MaterialOS -- The Architecture Behind Next-Gen Enterprise Software"
        description="MaterialOS is one intelligent operating system for every business -- sales, inventory, purchasing, credit, dispatch, and accounting, configured for your industry."
        path="/about"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/about")}
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

      <div className="relative mx-auto max-w-4xl px-6 py-12">
        <header className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span>Mission & System Architecture</span>
          </div>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-[1.15]">
            Engineering the Operating System for{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
              Modern Commerce.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-300 sm:text-xl sm:leading-relaxed">
            We built MaterialOS because enterprise software was fundamentally broken: legacy ERPs were slow, opaque, and hostile, while lightweight tools created fragmented data silos.
          </p>
        </header>

        {/* Core Architectural Tenets */}
        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-all duration-300 hover:border-violet-500/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400">
              <Cpu className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-bold text-white text-lg">Industry-Aware Engine</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Zero generic one-size-fits-all forms. The same robust core dynamically shifts terminology, units, batch tracking, and print templates to fit 26 distinct industry profiles.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-all duration-300 hover:border-violet-500/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-bold text-white text-lg">Database-Level Isolation</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Strict multi-tenant security architecture with encrypted vaults, GST statutory compliance by default, and tamper-evident audit logs on every single transaction.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-all duration-300 hover:border-violet-500/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Monitor className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-bold text-white text-lg">Native Multi-Platform</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Real high-performance desktop clients for Windows, macOS, and Linux alongside a responsive, sub-second web application and offline thermal receipt printing.
            </p>
          </div>
        </div>

        {/* Deep Dive Paragraphs */}
        <div className="mt-16 space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-sm leading-relaxed text-zinc-300 backdrop-blur-xl">
          <p>
            At MaterialOS, we believe modern businesses shouldn't have to choose between rigid multimillion-dollar ERPs like SAP and stitching together 10 different SaaS tools with fragile webhooks. When quotation, order confirmation, physical warehouse pick-list, GST invoice, and ledger entries all write to one live business graph, reconciliation headaches vanish.
          </p>
          <p>
            From small wholesale distributors managing 5,000 SKUs to multi-branch retail chains operating high-speed thermal POS counters, MaterialOS gives operators full real-time command of their working capital, stock, and credit.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Button
            size="lg"
            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 font-semibold text-white shadow-[0_0_25px_rgba(124,58,237,0.4)] transition-all hover:scale-[1.02] hover:from-violet-500 hover:to-indigo-500"
            asChild
          >
            <Link to="/signup">Start Free 14-Day Trial</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
