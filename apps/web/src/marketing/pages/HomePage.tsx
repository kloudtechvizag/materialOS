import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, ShieldCheck, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Seo, SITE_URL } from "@/components/marketing/Seo";
import { HeroSection } from "@/components/marketing/HeroSection";
import { IndustryMorphingSandbox } from "@/components/marketing/IndustryMorphingSandbox";
import { BentoGridFeatures } from "@/components/marketing/BentoGridFeatures";
import { InteractiveRoiCalculator } from "@/components/marketing/InteractiveRoiCalculator";
import { EnterpriseTrustStrip } from "@/components/marketing/EnterpriseTrustStrip";
import { PricingSection } from "@/components/marketing/PricingSection";

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
  const sandboxRef = useRef<HTMLDivElement>(null);

  const handleExploreDemo = () => {
    sandboxRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title="MaterialOS — The Intelligent Operating System Behind Next-Generation Businesses"
        description="Quotation to collection, stock rebalancing to statutory GST compliance — MaterialOS unifies sales, inventory, purchasing, thermal billing, and multi-branch operations for 26 industries."
        path="/"
        jsonLd={jsonLd}
      />

      {/* 1. Hero Section */}
      <HeroSection onExploreDemo={handleExploreDemo} />

      {/* 2. Flagship Industry Morphing Sandbox */}
      <div ref={sandboxRef} id="sandbox">
        <IndustryMorphingSandbox />
      </div>

      {/* 3. 6-Card Interactive Bento Grid */}
      <BentoGridFeatures />

      {/* 4. Interactive ROI & Value Simulator */}
      <InteractiveRoiCalculator />

      {/* 5. Enterprise Trust, Security & Client Testimonials */}
      <EnterpriseTrustStrip />

      {/* 6. High-Converting Pricing Engine */}
      <PricingSection />

      {/* 7. Bottom High-Converting Conversion CTA */}
      <section className="relative overflow-hidden border-t border-white/10 bg-gradient-to-b from-[#0B0F19] to-[#04070E] py-24 text-center">
        {/* Ambient radial glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[750px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.22)_0%,rgba(59,130,246,0.08)_50%,transparent_75%)] blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-4xl px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-300 backdrop-blur-md mb-6">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span>Join 1,200+ fast-growing modern enterprises</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
            Ready to Run Your Enterprise on{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
              One Intelligent System?
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base text-zinc-300 sm:text-lg">
            Say goodbye to fragile spreadsheets, manual GST reconciliation, and disconnected legacy software.
            Launch your pre-configured industry workspace in under 3 minutes.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 text-base font-semibold text-white shadow-[0_0_30px_-5px_rgba(124,58,237,0.6)] transition-all duration-300 hover:scale-[1.02] hover:from-violet-500 hover:to-indigo-500"
              asChild
            >
              <Link to="/signup">
                Start Free 14-Day Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="rounded-xl border-white/15 bg-white/5 px-8 py-6 text-base font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/30"
              asChild
            >
              <Link to="/book-demo">Book Architecture Walkthrough</Link>
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Full feature access</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Cancel or export anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-400" />
              <span>Dedicated migration engineer support</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
