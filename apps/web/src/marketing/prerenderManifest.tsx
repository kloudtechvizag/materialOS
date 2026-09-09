import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { ALL_INDUSTRIES, INDUSTRIES } from "@/marketing/content/industries";
import { FEATURES } from "@/marketing/content/features";
import { AboutPage } from "@/marketing/pages/AboutPage";
import { BookDemoPage } from "@/marketing/pages/BookDemoPage";
import { ComparePage } from "@/marketing/pages/ComparePage";
import { ContactPage } from "@/marketing/pages/ContactPage";
import { FeaturePage } from "@/marketing/pages/FeaturePage";
import { FeaturesIndexPage } from "@/marketing/pages/FeaturesIndexPage";
import { HomePage } from "@/marketing/pages/HomePage";
import { IndustriesIndexPage } from "@/marketing/pages/IndustriesIndexPage";
import { IndustryPage } from "@/marketing/pages/IndustryPage";
import { ProductOverviewPage } from "@/marketing/pages/ProductOverviewPage";
import { WhyMaterialOSPage } from "@/marketing/pages/WhyMaterialOSPage";

export interface PrerenderEntry {
  /** Concrete URL to render/write, e.g. "/industries/pharmacy". */
  path: string;
  /** react-router pattern to match it against, e.g. "/industries/:slug"
   * -- needed so useParams() resolves during the static render, same as
   * "/industries/pharmacy" for a non-parameterized page. */
  routePath: string;
  element: React.ReactNode;
}

function wrap(node: React.ReactNode) {
  return <MarketingLayout>{node}</MarketingLayout>;
}

/** Single source of truth for scripts/prerender.mjs: every public route
 * to statically render at build time, and (via ALL_INDUSTRIES) the full
 * 24-industry slug list robots.txt/sitemap.xml need. ALL_INDUSTRIES has
 * 24 entries but only the 5 in INDUSTRIES have full content -- only
 * those get a prerendered page + sitemap entry (§105: no thin pages). */
export const PRERENDER_ENTRIES: PrerenderEntry[] = [
  { path: "/", routePath: "/", element: wrap(<HomePage />) },
  { path: "/industries", routePath: "/industries", element: wrap(<IndustriesIndexPage />) },
  ...INDUSTRIES.map((industry) => ({
    path: `/industries/${industry.slug}`, routePath: "/industries/:slug", element: wrap(<IndustryPage />),
  })),
  { path: "/features", routePath: "/features", element: wrap(<FeaturesIndexPage />) },
  ...FEATURES.map((feature) => ({
    path: `/features/${feature.slug}`, routePath: "/features/:slug", element: wrap(<FeaturePage />),
  })),
  { path: "/why-materialos", routePath: "/why-materialos", element: wrap(<WhyMaterialOSPage />) },
  { path: "/compare", routePath: "/compare", element: wrap(<ComparePage />) },
  { path: "/product", routePath: "/product", element: wrap(<ProductOverviewPage />) },
  { path: "/about", routePath: "/about", element: wrap(<AboutPage />) },
  { path: "/contact", routePath: "/contact", element: wrap(<ContactPage />) },
  { path: "/book-demo", routePath: "/book-demo", element: wrap(<BookDemoPage />) },
  // /pricing is deliberately NOT prerendered -- it renders live plan/
  // addon data via react-query; baking today's prices into a static
  // file would go stale the moment an admin changes a price. It still
  // gets <Seo> client-side (see routes/PricingPage.tsx) and is listed
  // in the sitemap via scripts/prerender.mjs's extraPublicPaths.
];

export { ALL_INDUSTRIES };
