import { Link } from "react-router-dom";
import { Mail, MessageSquare, Headphones, ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Contact" }];

export function ContactPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title="Contact MaterialOS -- Enterprise Sales & Engineering Support"
        description="Get in touch with the MaterialOS team, or book a demo to see the platform configured for your industry."
        path="/contact"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/contact")}
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
            <span>Dedicated Enterprise Advisory</span>
          </div>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-[1.15]">
            Let's Talk About Your{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
              Business Architecture.
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base text-zinc-300 sm:text-lg">
            Have questions about multi-branch deployments, legacy data migration, or industry modules? Our solutions architects are here to help.
          </p>
        </header>

        {/* Contact Methods Grid */}
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-all duration-300 hover:border-violet-500/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400">
              <Headphones className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-bold text-white text-base">Schedule a Demo</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Walk through a customized live sandbox configured with sample inventory and workflows for your industry.
            </p>
            <Link to="/book-demo" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300">
              Book live walkthrough <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-all duration-300 hover:border-violet-500/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Mail className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-bold text-white text-base">Sales Engineering</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Direct inquiries for high-volume enterprise licenses, on-premise deployments, and custom SLAs.
            </p>
            <a href="mailto:solutions@materialos.app" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300">
              solutions@materialos.app <ArrowRight className="h-3 w-3" />
            </a>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-all duration-300 hover:border-violet-500/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-bold text-white text-base">Migration Advisory</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Questions regarding automated imports from Tally, Busy, QuickBooks, or custom SQL databases.
            </p>
            <a href="mailto:migration@materialos.app" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
              migration@materialos.app <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Action card */}
        <div className="mt-16 rounded-3xl border border-white/10 bg-gradient-to-br from-[#0B0F19] to-[#04070E] p-10 text-center shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Fastest Way to Explore: Start a Free Sandbox
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-300">
            Test real quotations, thermal receipt generation, and stock transfers right now in your browser.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Button
              size="lg"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 font-semibold text-white shadow-lg hover:from-violet-500 hover:to-indigo-500"
              asChild
            >
              <Link to="/signup">Launch Free Workspace</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
