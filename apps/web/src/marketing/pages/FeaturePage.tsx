import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Seo } from "@/components/marketing/Seo";
import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";
import { Faq, faqJsonLd } from "@/components/marketing/Faq";
import { getFeatureBySlug } from "@/marketing/content/features";
import { getIndustryBySlug } from "@/marketing/content/industries";
import { FEATURE_SCREENSHOTS } from "@/marketing/screenshots";
import { NotFoundPage } from "./NotFoundPage";

/** Reusable template for every flagship feature page (§108): Problem /
 * Solution / How It Works / Benefits / Workflow / Industries / FAQs /
 * CTA. */
export function FeaturePage() {
  const { slug } = useParams<{ slug: string }>();
  const feature = slug ? getFeatureBySlug(slug) : undefined;
  if (!feature) return <NotFoundPage />;

  const path = `/features/${feature.slug}`;
  const breadcrumbItems = [{ label: "Home", href: "/" }, { label: "Features", href: "/features" }, { label: feature.name }];
  const relatedIndustries = feature.relatedIndustrySlugs.map(getIndustryBySlug).filter((i) => i !== undefined);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title={feature.seoTitle}
        description={feature.seoDescription}
        path={path}
        jsonLd={[breadcrumbJsonLd(breadcrumbItems, path), ...(feature.faqs.length > 0 ? [faqJsonLd(feature.faqs)] : [])]}
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

      <div className="relative mx-auto max-w-5xl px-6 py-12">
        <Breadcrumbs items={breadcrumbItems} />

        <header className="mt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1 text-xs font-semibold text-violet-300">
            <span>Core Engine</span>
            <span className="text-white/30">•</span>
            <span>Real-Time Business Graph</span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {feature.name}:{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
              Built For Scale
            </span>
          </h1>

          <p className="mt-4 text-lg leading-relaxed text-zinc-300 sm:text-xl">{feature.solutionSummary}</p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Button
              size="lg"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-6 font-semibold text-white shadow-[0_0_25px_rgba(124,58,237,0.4)] transition-all hover:scale-[1.02] hover:from-violet-500 hover:to-indigo-500"
              asChild
            >
              <Link to="/signup">Start Free 14-Day Trial</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-xl border-white/15 bg-white/5 px-7 py-6 font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/30"
              asChild
            >
              <Link to="/book-demo">Request Architecture Demo</Link>
            </Button>
          </div>
        </header>

        {FEATURE_SCREENSHOTS[feature.slug] && (
          <div className="mt-12">
            <BrowserFrame src={FEATURE_SCREENSHOTS[feature.slug]} alt={`${feature.name} in MaterialOS`} />
          </div>
        )}

        {/* Problem Breakdown Card */}
        <section className="mt-16 rounded-2xl border border-rose-500/20 bg-rose-950/10 p-6 backdrop-blur-xl">
          <h2 className="text-lg font-bold tracking-tight text-rose-300">The Problem Without MaterialOS</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{feature.problem}</p>
        </section>

        {/* How It Works */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-white">How It Works</h2>
          <ol className="mt-6 space-y-4">
            {feature.howItWorks.map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md transition-all hover:border-violet-500/30"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-xs font-bold text-violet-300">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-zinc-300">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Key Benefits */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-white">Direct Operational Benefits</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {feature.benefits.map((benefit) => (
              <li
                key={benefit}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md transition-all hover:border-violet-500/30"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-zinc-200">{benefit}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* The Workflow */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-white">Operational Workflow Chain</h2>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            {feature.workflow.map((step, i) => (
              <span key={step} className="flex items-center gap-3">
                <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-medium text-zinc-200 backdrop-blur-md shadow-sm">
                  {step}
                </span>
                {i < feature.workflow.length - 1 && <ArrowRight className="h-4 w-4 text-violet-400" />}
              </span>
            ))}
          </div>
        </section>

        {/* Related Industries */}
        {relatedIndustries.length > 0 && (
          <section className="mt-16 border-t border-white/10 pt-10">
            <h2 className="text-lg font-bold tracking-tight text-white">Configured in These Industries</h2>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {relatedIndustries.map((related) => (
                <Link
                  key={related!.slug}
                  to={`/industries/${related!.slug}`}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur-md transition-colors hover:border-violet-500/40 hover:bg-white/10 hover:text-white"
                >
                  {related!.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQs */}
        <section className="mt-16 border-t border-white/10 pt-10">
          <Faq items={feature.faqs} />
        </section>

        {/* Bottom CTA */}
        <section className="mt-16 rounded-3xl border border-white/10 bg-gradient-to-br from-[#0B0F19] to-[#04070E] p-10 text-center shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            See {feature.name} Live in Your Own Workspace
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-300">
            Zero commitment. 14 days of full feature access with your industry's pre-configured profile.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Button
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-5 font-semibold text-white shadow-lg hover:from-violet-500 hover:to-indigo-500"
              asChild
            >
              <Link to="/signup">Start Free 14-Day Trial</Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-white/15 bg-white/5 px-7 py-5 font-semibold text-white backdrop-blur-md hover:bg-white/10 hover:border-white/30"
              asChild
            >
              <Link to="/book-demo">Schedule Walkthrough</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
