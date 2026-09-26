import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";
import { ALL_INDUSTRIES, getIndustryBySlug } from "@/marketing/content/industries";
import { CATEGORY_ICONS, DEFAULT_ICON } from "@/marketing/icons";
import { paletteColor } from "@/marketing/palette";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Industries" }];

export function IndustriesIndexPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", ...Array.from(new Set(ALL_INDUSTRIES.map((i) => i.category)))];

  const filteredIndustries = selectedCategory === "All"
    ? ALL_INDUSTRIES
    : ALL_INDUSTRIES.filter((i) => i.category === selectedCategory);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title="Industries -- Business Software Configured for 26 Modern Industries"
        description="MaterialOS is tailored for 26 modern industries, from building materials and retail to pharmacy, printing, and laboratory testing -- one platform, industry-specific workflows."
        path="/industries"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/industries")}
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
      <header className="relative mx-auto max-w-4xl px-6 pb-8 pt-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-300 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <span>26 Native Industry Configurations • Zero Generic ERP Bloat</span>
        </div>

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.15]">
          Configured for how your business{" "}
          <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
            actually operates.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-300 sm:text-xl sm:leading-relaxed">
          Every profile below is pre-wired with industry-specific terminology, sales models, print templates, and GST statutory rules out of the box.
        </p>

        {/* Category Filters */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-all duration-200 ${
                selectedCategory === cat
                  ? "border border-violet-500/40 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                  : "border border-white/10 bg-white/5 text-zinc-400 backdrop-blur-md hover:border-white/20 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* 26 Industry Glass Cards Grid */}
      <div className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredIndustries.map((industry, i) => {
            const content = getIndustryBySlug(industry.slug);
            const Icon = CATEGORY_ICONS[industry.category] ?? DEFAULT_ICON;
            const color = paletteColor(i);

            const card = (
              <Card
                className={`group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all duration-300 ${
                  content
                    ? "hover:-translate-y-1 hover:border-violet-500/40 hover:bg-white/[0.06] hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
                    : "opacity-60"
                }`}
              >
                <CardContent className="flex h-full flex-col justify-between p-6">
                  <div>
                    <div className="flex items-start justify-between">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ring-1 ring-white/15"
                        style={{ backgroundColor: `${color.bg}30` }}
                      >
                        <Icon className="h-7 w-7" style={{ color: color.fg }} />
                      </div>
                      {content ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Configured
                        </span>
                      ) : (
                        <Badge variant="outline" className="border-white/10 bg-white/5 text-xs text-zinc-400">
                          Sandbox Ready
                        </Badge>
                      )}
                    </div>

                    <h2 className="mt-5 text-xl font-bold tracking-tight text-white group-hover:text-violet-300 transition-colors">
                      {industry.name}
                    </h2>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      {industry.category}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-zinc-300">
                      {content?.heroTagline ?? "Pre-packaged ledger rules, terminology, and customized POS and dispatch workflows."}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
                    <span className="text-zinc-500 font-mono">Profile v2.0</span>
                    {content ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-violet-400 group-hover:text-violet-300">
                        View profile <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                      </span>
                    ) : (
                      <span className="text-zinc-500">Universal Core</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );

            return content ? (
              <Link key={industry.slug} to={`/industries/${industry.slug}`}>
                {card}
              </Link>
            ) : (
              <div key={industry.slug}>{card}</div>
            );
          })}
        </div>

        {/* CTA Strip */}
        <div className="mt-20 rounded-3xl border border-white/10 bg-gradient-to-r from-violet-950/40 via-indigo-950/40 to-slate-900/60 p-8 text-center backdrop-blur-xl sm:p-12">
          <h3 className="text-2xl font-bold text-white sm:text-3xl">Don't see your exact industry listed?</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-300">
            MaterialOS features an extensible capability matrix. Custom units of measurement, batch fields, and tax regimes configure in minutes.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold shadow-lg hover:from-violet-500 hover:to-indigo-500 text-white" asChild>
              <Link to="/book-demo">Request Industry Walkthrough</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
