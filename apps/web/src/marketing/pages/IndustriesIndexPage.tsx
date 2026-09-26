import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, CheckCircle2, Search, SlidersHorizontal, Layers, ShieldCheck, Zap } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";
import { ALL_INDUSTRIES, getIndustryBySlug } from "@/marketing/content/industries";
import { CATEGORY_ICONS, DEFAULT_ICON } from "@/marketing/icons";
import { paletteColor } from "@/marketing/palette";
import { INDUSTRY_IMAGES, INDUSTRY_MODULES } from "@/marketing/content/industryImages";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Industries" }];

const FLAGSHIPS = [
  {
    slug: "building_materials",
    metric: "₹4.9M Outward GST Ledger",
    highlight: "Dual-UOM piece & kg weight tracking with live credit checks",
    badge: "Dealer & Distribution",
  },
  {
    slug: "retail",
    metric: "Sub-Second Counter POS",
    highlight: "Split Cash/UPI/Card payment checkout with instant stock deduction",
    badge: "High-Volume Counter",
  },
  {
    slug: "pharmacy",
    metric: "Zero-Waste FEFO Engine",
    highlight: "First-expiry-first-out automated batch dispatch and near-expiry alerts",
    badge: "Compliance & Expiry",
  },
];

export function IndustriesIndexPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(ALL_INDUSTRIES.map((i) => i.category)))];
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: ALL_INDUSTRIES.length };
    for (const ind of ALL_INDUSTRIES) {
      counts[ind.category] = (counts[ind.category] || 0) + 1;
    }
    return counts;
  }, []);

  const filteredIndustries = useMemo(() => {
    return ALL_INDUSTRIES.filter((industry) => {
      const matchesCategory = selectedCategory === "All" || industry.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        industry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        industry.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (INDUSTRY_MODULES[industry.slug] ?? []).some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title="Industries -- Business Software Configured for 25+ Modern Verticals | MaterialOS"
        description="MaterialOS provides tailored operational engines for 25+ modern industries, from building materials and retail to pharmacy, logistics, and precision manufacturing."
        path="/industries"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/industries")}
      />

      {/* Ambient background aura glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[1000px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.22)_0%,rgba(59,130,246,0.12)_45%,transparent_75%)] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-8">
        <Breadcrumbs items={BREADCRUMB_ITEMS} />
      </div>

      {/* Page Header */}
      <header className="relative mx-auto max-w-4xl px-6 pb-6 pt-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-300 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <span>25 Pre-Configured Industry Operating Engines • Zero Generic ERP Bloat</span>
        </div>

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.15]">
          Configured for how your industry{" "}
          <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
            actually operates.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-300 sm:text-xl sm:leading-relaxed">
          Every profile includes domain-specific ledger logic, dual units of measurement, statutory GST compliance, and customized POS/dispatch workflows right out of the box.
        </p>
      </header>

      {/* Flagship Bento Spotlight */}
      <section className="relative mx-auto max-w-6xl px-6 pb-12 pt-4">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-violet-300">Flagship Production Deployments</span>
          </div>
          <span className="text-xs text-zinc-500">Live Seeded Demo Data Available</span>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {FLAGSHIPS.map((flagship) => {
            const industry = ALL_INDUSTRIES.find((i) => i.slug === flagship.slug)!;
            const content = getIndustryBySlug(flagship.slug);
            const image = INDUSTRY_IMAGES[flagship.slug];

            return (
              <Link
                key={flagship.slug}
                to={`/industries/${flagship.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03] backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1.5 hover:border-violet-500/50 hover:shadow-[0_0_35px_rgba(124,58,237,0.25)]"
              >
                {/* 16:9 Image Banner with dark overlay blend */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#070B14]">
                  <img
                    src={image}
                    alt={industry.name}
                    className="h-full w-full object-cover object-center opacity-85 transition-transform duration-500 ease-out group-hover:scale-105 group-hover:opacity-100"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/40 to-transparent" />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-950/80 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur-md">
                    <CheckCircle2 className="h-3 w-3" />
                    Production Ready
                  </span>
                  <span className="absolute right-3 top-3 rounded-md border border-white/10 bg-black/60 px-2 py-0.5 font-mono text-[10px] text-zinc-300 backdrop-blur-md">
                    {flagship.badge}
                  </span>
                </div>

                {/* Card Body */}
                <div className="flex flex-1 flex-col justify-between p-5 bg-[#0B0F19]/80">
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors">
                      {industry.name}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                      {content?.heroTagline ?? flagship.highlight}
                    </p>

                    <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-950/20 px-3 py-2">
                      <span className="text-[10px] uppercase font-semibold text-violet-300 block">Verified Operational Metric</span>
                      <span className="text-xs font-mono font-bold text-white">{flagship.metric}</span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                    <span className="text-violet-400 font-semibold group-hover:text-violet-300 flex items-center gap-1">
                      Launch architecture <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">v2.0 Native</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Search & Category Filter Hub */}
      <section className="relative mx-auto max-w-6xl px-6 pt-4 pb-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl md:p-6 shadow-[0_15px_30px_rgba(0,0,0,0.3)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                type="text"
                placeholder="Search by industry, capability, or module (e.g. POS, FEFO, IMEI)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-xl border-white/10 bg-white/5 pl-10 pr-4 text-xs text-white placeholder:text-zinc-500 focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20"
              />
            </div>

            {/* Quick stats indicator */}
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Layers className="h-3.5 w-3.5 text-violet-400" />
              <span>Showing <strong className="text-white font-mono">{filteredIndustries.length}</strong> of {ALL_INDUSTRIES.length} profiles</span>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
            {categories.map((cat) => {
              const count = categoryCounts[cat] ?? 0;
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all duration-200 ${
                    isActive
                      ? "border border-violet-500/50 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.35)]"
                      : "border border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                      isActive ? "bg-white/20 text-white" : "bg-white/5 text-zinc-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 25 Industry Cards Grid with Visual Banners */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        {filteredIndustries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center text-zinc-400">
            <SlidersHorizontal className="mx-auto h-8 w-8 text-zinc-500" />
            <h3 className="mt-3 text-base font-semibold text-white">No industry matching "{searchQuery}"</h3>
            <p className="mt-1 text-xs">Try searching for other keywords like "inventory", "POS", or clear your filter.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              className="mt-4 border-white/10 text-xs"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredIndustries.map((industry, i) => {
              const content = getIndustryBySlug(industry.slug);
              const Icon = CATEGORY_ICONS[industry.category] ?? DEFAULT_ICON;
              const color = paletteColor(i);
              const image = INDUSTRY_IMAGES[industry.slug];
              const modules = INDUSTRY_MODULES[industry.slug] ?? ["Universal Stock Ledger", "GST Accounting", "Sales Orders"];

              const cardContent = (
                <Card className="group relative h-full flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:bg-white/[0.05] hover:shadow-[0_20px_40px_rgba(0,0,0,0.6),0_0_30px_rgba(124,58,237,0.12)]">
                  {/* Visual Image Banner with Gradient Vignette */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#070B14]">
                    {image && (
                      <img
                        src={image}
                        alt={industry.name}
                        className="h-full w-full object-cover object-center opacity-80 transition-transform duration-500 ease-out group-hover:scale-105 group-hover:opacity-100"
                        loading="lazy"
                      />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/50 to-transparent" />

                    {/* Floating Icon Container with Ambient Halo */}
                    <div
                      className="absolute bottom-3 left-4 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg ring-1 ring-white/20 backdrop-blur-md"
                      style={{ backgroundColor: `${color.bg}40`, boxShadow: `0 0 20px ${color.bg}60` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: color.fg }} />
                    </div>

                    {/* Category pill */}
                    <div className="absolute right-3 top-3">
                      <span className="rounded-full border border-white/10 bg-black/60 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-300 backdrop-blur-md">
                        {industry.category}
                      </span>
                    </div>
                  </div>

                  {/* Card Main Information */}
                  <CardContent className="flex flex-1 flex-col justify-between p-5 pt-3 bg-[#0B0F19]/90">
                    <div>
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold tracking-tight text-white group-hover:text-violet-300 transition-colors">
                          {industry.name}
                        </h2>
                        {content ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Configured
                          </span>
                        ) : (
                          <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] text-zinc-400">
                            Sandbox Ready
                          </Badge>
                        )}
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-zinc-300 line-clamp-2">
                        {content?.heroTagline ?? "Pre-packaged ledger rules, terminology, and customized POS and dispatch workflows."}
                      </p>

                      {/* Native Modules Pills */}
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {modules.slice(0, 3).map((mod) => (
                          <span
                            key={mod}
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
                          >
                            {mod}
                          </span>
                        ))}
                        {modules.length > 3 && (
                          <span className="rounded-md border border-white/5 bg-white/[0.02] px-1.5 py-0.5 text-[10px] text-zinc-500">
                            +{modules.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                      <span className="text-zinc-500 font-mono text-[11px]">Profile v2.0</span>
                      {content ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-violet-400 group-hover:text-violet-300 transition-colors">
                          View profile <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-zinc-400 group-hover:text-white transition-colors">
                          Launch sandbox <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );

              return content ? (
                <Link key={industry.slug} to={`/industries/${industry.slug}`} className="block h-full">
                  {cardContent}
                </Link>
              ) : (
                <Link key={industry.slug} to={`/signup?industry=${industry.slug}`} className="block h-full">
                  {cardContent}
                </Link>
              );
            })}
          </div>
        )}

        {/* Custom Industry Tailoring Banner */}
        <div className="mt-20 rounded-3xl border border-white/10 bg-gradient-to-r from-violet-950/40 via-indigo-950/40 to-slate-900/60 p-8 text-center backdrop-blur-xl sm:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
            <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
            <span>Extensible Architecture</span>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Don't see your exact industry listed?</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-300">
            MaterialOS features an extensible capability matrix. Custom units of measurement, batch fields, barcode formats, and statutory tax regimes configure in minutes.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold shadow-lg hover:from-violet-500 hover:to-indigo-500 text-white" asChild>
              <Link to="/book-demo">Request Industry Architecture Session</Link>
            </Button>
            <Button variant="outline" className="rounded-xl border-white/15 bg-white/5 font-semibold text-white hover:bg-white/10" asChild>
              <Link to="/compare">Compare Platform Capabilities</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
