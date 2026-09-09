import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";
import { Faq, faqJsonLd } from "@/components/marketing/Faq";
import { getFeatureBySlug } from "@/marketing/content/features";
import { getIndustryBySlug } from "@/marketing/content/industries";
import { NotFoundPage } from "./NotFoundPage";

/** Reusable template for every flagship industry landing page (§106):
 * Hero / Problems / Solution / Capabilities / Workflow / Use Cases /
 * FAQs / Related / CTA. Dashboard-Preview and AI-Features sections from
 * the spec's own example are deliberately omitted -- no real screenshot
 * pipeline exists, and the AI layer is out of scope right now. */
export function IndustryPage() {
  const { slug } = useParams<{ slug: string }>();
  const industry = slug ? getIndustryBySlug(slug) : undefined;
  if (!industry) return <NotFoundPage />;

  const path = `/industries/${industry.slug}`;
  const breadcrumbItems = [{ label: "Home", href: "/" }, { label: "Industries", href: "/industries" }, { label: industry.name }];
  const relatedIndustries = industry.relatedIndustrySlugs.map(getIndustryBySlug).filter((i) => i !== undefined);
  const relatedFeatures = industry.relatedFeatureSlugs.map(getFeatureBySlug).filter((f) => f !== undefined);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Seo
        title={industry.seoTitle}
        description={industry.seoDescription}
        path={path}
        jsonLd={[breadcrumbJsonLd(breadcrumbItems, path), ...(industry.faqs.length > 0 ? [faqJsonLd(industry.faqs)] : [])]}
      />
      <Breadcrumbs items={breadcrumbItems} />

      <header className="mt-4">
        <p className="text-sm font-medium uppercase tracking-wide text-[#7C3AED]">{industry.category}</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{industry.name} software, built for real workflows</h1>
        <p className="mt-3 text-lg text-muted-foreground">{industry.heroTagline}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" asChild>
            <Link to="/book-demo">Book a demo</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/signup">Start free</Link>
          </Button>
        </div>
      </header>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">The problems {industry.name.toLowerCase()} businesses run into</h2>
        <ul className="mt-4 space-y-2">
          {industry.problems.map((problem) => (
            <li key={problem} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#EF4444]" />
              {problem}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">How MaterialOS solves it</h2>
        <p className="mt-3 text-muted-foreground">{industry.solution}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">What you get</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {industry.capabilities.map((capability) => (
            <li key={capability} className="flex gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
              {capability}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">The workflow</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {industry.workflow.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 font-medium">{step}</span>
              {i < industry.workflow.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Use cases</h2>
        <ul className="mt-4 space-y-3">
          {industry.useCases.map((useCase) => (
            <li key={useCase} className="rounded-lg border border-[#E2E8F0] bg-white p-4 text-sm text-muted-foreground shadow-sm">
              {useCase}
            </li>
          ))}
        </ul>
      </section>

      {(relatedIndustries.length > 0 || relatedFeatures.length > 0) && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Related</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {relatedIndustries.map((related) => (
              <Link key={related!.slug} to={`/industries/${related!.slug}`} className="rounded-full border border-[#E2E8F0] px-3 py-1.5 text-sm hover:bg-[#F8FAFC]">
                {related!.name}
              </Link>
            ))}
            {relatedFeatures.map((related) => (
              <Link key={related!.slug} to={`/features/${related!.slug}`} className="rounded-full border border-[#E2E8F0] px-3 py-1.5 text-sm hover:bg-[#F8FAFC]">
                {related!.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <Faq items={industry.faqs} />
      </section>

      <section className="mt-12 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
        <h2 className="text-xl font-semibold">Ready to run your {industry.name.toLowerCase()} business on one system?</h2>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" asChild>
            <Link to="/signup">Start free</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/book-demo?industry=${industry.slug}`}>Book a demo</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
