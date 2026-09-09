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
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Seo
        title={feature.seoTitle}
        description={feature.seoDescription}
        path={path}
        jsonLd={[breadcrumbJsonLd(breadcrumbItems, path), ...(feature.faqs.length > 0 ? [faqJsonLd(feature.faqs)] : [])]}
      />
      <Breadcrumbs items={breadcrumbItems} />

      <header className="mt-4">
        <h1 className="text-3xl font-semibold sm:text-4xl">{feature.name}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{feature.solutionSummary}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" asChild>
            <Link to="/book-demo">Book a demo</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/signup">Start free</Link>
          </Button>
        </div>
      </header>

      {FEATURE_SCREENSHOTS[feature.slug] && (
        <div className="mt-10">
          <BrowserFrame src={FEATURE_SCREENSHOTS[feature.slug]} alt={`${feature.name} in MaterialOS`} />
        </div>
      )}

      <section className="mt-12">
        <h2 className="text-xl font-semibold">The problem</h2>
        <p className="mt-3 text-muted-foreground">{feature.problem}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ol className="mt-4 space-y-3">
          {feature.howItWorks.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EDE9FE] text-xs font-semibold text-[#7C3AED]">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Benefits</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {feature.benefits.map((benefit) => (
            <li key={benefit} className="flex gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
              {benefit}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">The workflow</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {feature.workflow.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 font-medium">{step}</span>
              {i < feature.workflow.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </span>
          ))}
        </div>
      </section>

      {relatedIndustries.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Used across these industries</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {relatedIndustries.map((related) => (
              <Link key={related!.slug} to={`/industries/${related!.slug}`} className="rounded-full border border-[#E2E8F0] px-3 py-1.5 text-sm hover:bg-[#F8FAFC]">
                {related!.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <Faq items={feature.faqs} />
      </section>

      <section className="mt-12 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
        <h2 className="text-xl font-semibold">See {feature.name.toLowerCase()} in your own workspace</h2>
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
