import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "About" }];

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Seo
        title="About MaterialOS"
        description="MaterialOS is one intelligent operating system for every business -- sales, inventory, purchasing, credit, dispatch, and accounting, configured for your industry."
        path="/about"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/about")}
      />
      <Breadcrumbs items={BREADCRUMB_ITEMS} />
      <h1 className="mt-4 text-3xl font-semibold">About MaterialOS</h1>
      <div className="mt-6 space-y-4 text-muted-foreground">
        <p>
          MaterialOS is a business operating system, not a generic ERP. Instead of a one-size-fits-all product with
          every industry bolted on as a checkbox, MaterialOS is built around a configurable industry-profile engine --
          the same core (sales, inventory, purchasing, credit, dispatch, accounting) adapts its terminology, enabled
          modules, and dashboard to how a building materials dealer, a pharmacy, a retail shop, or a print shop
          actually works.
        </p>
        <p>
          The platform is multi-tenant with strict, database-enforced tenant isolation, GST-compliant accounting by
          default, and a real desktop app (Windows, macOS, and Linux) alongside the web application.
        </p>
      </div>
    </div>
  );
}
