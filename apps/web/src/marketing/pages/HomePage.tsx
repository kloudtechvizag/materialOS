import { Link } from "react-router-dom";
import { ArrowRight, Building2, CreditCard, Package, Receipt, Smartphone, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Seo, SITE_URL } from "@/components/marketing/Seo";
import { ALL_INDUSTRIES, INDUSTRIES } from "@/marketing/content/industries";
import { FEATURES } from "@/marketing/content/features";

const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "inventory-management": Package,
  "sales-quotation-management": Receipt,
  "credit-management": CreditCard,
  pos: CreditCard,
  "warehouse-dispatch-management": Truck,
  "serial-imei-rma-tracking": Smartphone,
  "gst-accounting-financial-reports": Receipt,
  "report-builder": Building2,
};

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

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
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

      <section className="border-t border-[#E2E8F0] bg-[#F8FAFC] py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Built for your industry</h2>
            <Link to="/industries" className="flex items-center gap-1 text-sm font-medium text-[#7C3AED] hover:underline">
              All {ALL_INDUSTRIES.length} industries <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((industry) => (
              <Link key={industry.slug} to={`/industries/${industry.slug}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="p-6">
                    <h3 className="font-semibold">{industry.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{industry.heroTagline}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-semibold">Everything runs on one platform</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = FEATURE_ICONS[feature.slug] ?? Package;
              return (
                <Link key={feature.slug} to={`/features/${feature.slug}`}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardContent className="p-6">
                      <Icon className="h-6 w-6 text-[#7C3AED]" />
                      <h3 className="mt-3 font-semibold">{feature.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{feature.problem}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-[#E2E8F0] bg-[#F8FAFC] py-16 text-center">
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
