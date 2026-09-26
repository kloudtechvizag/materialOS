import { Link } from "react-router-dom";
import { ArrowRight, Package, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";
import { FEATURES } from "@/marketing/content/features";
import { FEATURE_ICONS } from "@/marketing/icons";
import { paletteColor } from "@/marketing/palette";
import { FEATURE_SCREENSHOTS } from "@/marketing/screenshots";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Features" }];

export function FeaturesIndexPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title="Features -- Everything MaterialOS Runs on One Platform"
        description="Inventory, sales, credit, POS, dispatch, serial/IMEI tracking, GST accounting, and a custom report builder -- all on one connected platform."
        path="/features"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/features")}
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

      {/* Header */}
      <header className="relative mx-auto max-w-4xl px-6 pb-6 pt-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-300 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <span>Native Platform Engines • Zero Third-Party Plugins</span>
        </div>

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.15]">
          Production-grade capabilities,{" "}
          <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
            engineered to scale.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-300 sm:text-xl sm:leading-relaxed">
          Every feature below writes directly to the MaterialOS transaction graph. Real-time ledger updates, sub-second search, and tamper-proof audit trails.
        </p>
      </header>

      {/* Features Grid */}
      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = FEATURE_ICONS[feature.slug] ?? Package;
            const color = paletteColor(i);
            const screenshot = FEATURE_SCREENSHOTS[feature.slug];

            return (
              <Link key={feature.slug} to={`/features/${feature.slug}`} className="group">
                <Card className="h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:bg-white/[0.06] hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ring-1 ring-white/15"
                        style={{ backgroundColor: `${color.bg}30` }}
                      >
                        <Icon className="h-7 w-7" style={{ color: color.fg }} />
                      </div>
                      <span className="text-xs font-mono text-zinc-500">ENG-{i + 1 < 10 ? `0${i + 1}` : i + 1}</span>
                    </div>

                    <h2 className="mt-5 text-xl font-bold tracking-tight text-white group-hover:text-violet-300 transition-colors">
                      {feature.name}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{feature.problem}</p>

                    <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-violet-400 group-hover:text-violet-300">
                      <span>Explore feature</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>

                  {screenshot && (
                    <div className="relative h-36 border-t border-white/10 bg-[#0B0F19]/80 overflow-hidden">
                      <img
                        src={screenshot}
                        alt=""
                        className="h-full w-full object-cover object-top opacity-90 transition-transform duration-500 ease-out group-hover:scale-105 group-hover:opacity-100"
                        loading="lazy"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070B14]/80 to-transparent" />
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
