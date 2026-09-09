import { Link } from "react-router-dom";
import { Package } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";
import { FEATURES } from "@/marketing/content/features";
import { FEATURE_ICONS } from "@/marketing/icons";
import { paletteColor } from "@/marketing/palette";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Features" }];

export function FeaturesIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Seo
        title="Features -- Everything MaterialOS Runs on One Platform"
        description="Inventory, sales, credit, POS, dispatch, serial/IMEI tracking, GST accounting, and a custom report builder -- all on one connected platform."
        path="/features"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/features")}
      />
      <Breadcrumbs items={BREADCRUMB_ITEMS} />
      <h1 className="mt-4 text-3xl font-semibold">Features</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Every capability below is real, tested, and already running in MaterialOS.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, i) => {
          const Icon = FEATURE_ICONS[feature.slug] ?? Package;
          const color = paletteColor(i);
          return (
            <Link key={feature.slug} to={`/features/${feature.slug}`}>
              <Card className="h-full border-[#E2E8F0] transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: color.bg }}>
                    <Icon className="h-5 w-5" style={{ color: color.fg }} />
                  </div>
                  <h2 className="mt-4 font-semibold">{feature.name}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.problem}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
