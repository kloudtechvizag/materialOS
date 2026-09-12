import { Link } from "react-router-dom";
import { ArrowRight, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Seo, SITE_URL } from "@/components/marketing/Seo";
import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { ModuleCard } from "@/components/marketing/ModuleCard";
import { ALL_INDUSTRIES, INDUSTRIES } from "@/marketing/content/industries";
import { FEATURES } from "@/marketing/content/features";
import { FEATURE_ICONS, INDUSTRY_ICONS } from "@/marketing/icons";
import { paletteGradient } from "@/marketing/palette";
import { FEATURE_SCREENSHOTS } from "@/marketing/screenshots";

const jsonLd = [
  { "@context": "https://schema.org", "@type": "Organization", name: "MaterialOS", url: SITE_URL, logo: `${SITE_URL}/brand/symbol.svg` },
  { "@context": "https://schema.org", "@type": "WebSite", name: "MaterialOS", url: SITE_URL },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MaterialOS",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Windows, macOS, Linux",
  },
];

export function HomePage() {
  return (
    <>
      <Seo
        title="MaterialOS -- One Intelligent Operating System for Every Business"
        description="Sales, inventory, purchasing, credit, dispatch, and GST accounting on one connected platform -- configured for your industry, not a generic ERP."
        path="/"
        jsonLd={jsonLd}
      />

      <section className="mx-auto max-w-5xl px-6 pt-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">One intelligent operating system for every business.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Quotation to collection, purchase to payment, stock to statement -- MaterialOS runs your business as one
          connected system, configured for the way your industry actually works.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" asChild>
            <Link to="/signup">Start free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/book-demo">Book a demo</Link>
          </Button>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-20 pt-14">
        <div
          className="pointer-events-none absolute inset-x-8 -top-10 h-64 bg-[radial-gradient(60%_60%_at_50%_35%,rgba(124,58,237,0.14),transparent_70%)]"
          aria-hidden="true"
        />
        <BrowserFrame
          src="/screenshots/dashboard.webp"
          alt="MaterialOS dashboard showing outstanding, invoiced, quotations, and stock in real time"
          className="relative -rotate-1 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.35)] transition-transform duration-500 hover:rotate-0"
        />
      </section>

      <section className="border-t border-black/[0.06] bg-[#F9FAFB] py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Built for your industry</h2>
            <Link to="/industries" className="flex items-center gap-1 text-sm font-medium text-[#7C3AED] hover:underline">
              All {ALL_INDUSTRIES.length} industries <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((industry, i) => (
              <ModuleCard
                key={industry.slug}
                to={`/industries/${industry.slug}`}
                icon={INDUSTRY_ICONS[industry.slug] ?? Package}
                gradient={paletteGradient(i)}
                name={industry.name}
                tagline={industry.heroTagline}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Everything runs on one platform</h2>
          <div className="mt-8 grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, i) => (
              <ModuleCard
                key={feature.slug}
                to={`/features/${feature.slug}`}
                icon={FEATURE_ICONS[feature.slug] ?? Package}
                gradient={paletteGradient(i)}
                name={feature.name}
                tagline={feature.problem}
                screenshot={FEATURE_SCREENSHOTS[feature.slug]}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-black/[0.06] bg-[#F9FAFB] py-16 text-center">
        <h2 className="text-2xl font-semibold">Ready to run your business on one system?</h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" asChild>
            <Link to="/signup">Start free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/book-demo">Book a demo</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
