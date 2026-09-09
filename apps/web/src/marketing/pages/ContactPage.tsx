import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Contact" }];

export function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Seo
        title="Contact MaterialOS"
        description="Get in touch with the MaterialOS team, or book a demo to see the platform configured for your industry."
        path="/contact"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/contact")}
      />
      <Breadcrumbs items={BREADCRUMB_ITEMS} />
      <h1 className="mt-4 text-3xl font-semibold">Contact us</h1>
      <p className="mt-3 text-muted-foreground">
        For a walkthrough of MaterialOS configured for your industry, the fastest way to reach us is to book a demo.
      </p>
      <Button className="mt-6 bg-[#7C3AED] text-white hover:bg-[#6D28D9]" asChild>
        <Link to="/book-demo">Book a demo</Link>
      </Button>
    </div>
  );
}
