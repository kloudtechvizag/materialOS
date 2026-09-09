import { Link } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";
import { ALL_INDUSTRIES, getIndustryBySlug } from "@/marketing/content/industries";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Industries" }];

/** Lists all 24 real industries MaterialOS supports (mirroring
 * app/services/industry.py's PROFILE_DEFINITIONS) -- only the ones with
 * a full content entry (getIndustryBySlug) are linked; the rest render
 * as plain unlinked cards rather than thin pages (§105). */
export function IndustriesIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Seo
        title="Industries -- Business Software for 24 Industries"
        description="MaterialOS is configured for 24 industries, from building materials and retail to pharmacy and printing -- one platform, industry-specific workflows."
        path="/industries"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/industries")}
      />
      <Breadcrumbs items={BREADCRUMB_ITEMS} />
      <h1 className="mt-4 text-3xl font-semibold">Industries MaterialOS supports</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Every industry below is a real, configured profile -- terminology, modules, and dashboard all adapt automatically.
        Detailed pages are available for the industries below; more are on the way.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_INDUSTRIES.map((industry) => {
          const content = getIndustryBySlug(industry.slug);
          const card = (
            <Card className={content ? "h-full transition-shadow hover:shadow-md" : "h-full opacity-60"}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{industry.name}</h2>
                  {!content && <Badge variant="outline" className="text-xs">Coming soon</Badge>}
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{industry.category}</p>
              </CardContent>
            </Card>
          );
          return content ? (
            <Link key={industry.slug} to={`/industries/${industry.slug}`}>
              {card}
            </Link>
          ) : (
            <div key={industry.slug}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
