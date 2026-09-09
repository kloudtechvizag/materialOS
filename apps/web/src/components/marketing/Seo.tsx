import { Helmet } from "react-helmet-async";

const SITE_NAME = "MaterialOS";
const SITE_URL = "https://materialos.com"; // canonical domain -- not yet deployed publicly, see plan/ADR
const DEFAULT_OG_IMAGE = `${SITE_URL}/brand/og-default.png`;

interface SeoProps {
  title: string;
  description: string;
  /** Path only, e.g. "/industries/pharmacy" -- resolved against SITE_URL. */
  path: string;
  ogImage?: string;
  /** One or more JSON-LD objects (Organization, BreadcrumbList, FAQPage, ...). */
  jsonLd?: object | object[];
}

/** Per-page metadata for every marketing page -- title, description,
 * canonical, Open Graph, Twitter card, and structured data, all real
 * per-page values (never a shared default). Rendered both client-side
 * (react-helmet-async's DOM mode) and by scripts/prerender.mjs, which
 * reads the same Helmet output server-side to bake it into the static
 * HTML for crawlers that don't execute JS. */
export function Seo({ title, description, path, ogImage = DEFAULT_OG_IMAGE, jsonLd }: SeoProps) {
  const canonical = `${SITE_URL}${path}`;
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const jsonLdEntries = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLdEntries.map((entry, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(entry)}
        </script>
      ))}
    </Helmet>
  );
}

export { SITE_NAME, SITE_URL };
