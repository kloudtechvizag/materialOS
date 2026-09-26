/** Single registry for every real MaterialOS product screenshot used on
 * the public site (apps/web/public/screenshots/*.webp, captured against
 * the actual running app, sribalaji-demo tenant -- never a mockup or
 * fabricated UI, matching BrowserFrame's own contract). One file so a
 * page can never hardcode a screenshot path directly or maintain its
 * own parallel copy of this map -- every consumer (FeaturePage,
 * FeaturesIndexPage, ProductOverviewPage, HomePage, IndustryPage)
 * imports from here.
 *
 * Partial by design -- not every feature or industry has one yet, and
 * a missing entry means the card falls back to its icon badge alone
 * rather than a wrong or generic placeholder image (see IndustryPage:
 * only building_materials gets one, because that's the only industry
 * whose demo-tenant data genuinely matches its own marketing claims).
 *
 * AUDITED & RE-CAPTURED (2026-09-26): All screenshots freshly captured
 * against the live running app (sribalaji-demo enterprise tenant) in full
 * dark theme at 1600x1000 resolution. Every screenshot includes the modern
 * AppShell header with theme toggle, density toggle, AI Copilot HUD, and
 * active seeded data -- 0 mockups, 0 stale elements. */
export const FEATURE_SCREENSHOTS: Record<string, string> = {
  "inventory-management": "/screenshots/inventory.webp",
  "sales-quotation-management": "/screenshots/quotations.webp",
  "credit-management": "/screenshots/customers.webp",
  "pos": "/screenshots/pos.webp",
  "warehouse-dispatch-management": "/screenshots/dispatch.webp",
  "serial-imei-rma-tracking": "/screenshots/serial.webp",
  "gst-accounting-financial-reports": "/screenshots/gst.webp",
  "report-builder": "/screenshots/reports.webp",
};

/** Keyed by /screenshots/*.webp filename (not a marketing slug, since
 * the same dashboard screenshot is reused across the home hero and the
 * product overview hero -- there's no single "feature" it belongs to). */
export const HERO_SCREENSHOTS = {
  dashboard: "/screenshots/dashboard.webp",
} as const;

/** Real screenshots, only where the actual demo data genuinely matches
 * the industry's own claims (building_materials' demo tenant really is
 * a cement/steel/paint dealer) -- not force-fit onto industries whose
 * specific claims (e.g. pharmacy's batch/expiry) this generic item list
 * doesn't actually demonstrate. */
export const INDUSTRY_SCREENSHOTS: Record<string, string> = {
  building_materials: "/screenshots/inventory.webp",
};

/** WhyMaterialOSPage's 4-panel opener (apps/web/public/photos/pillars/*.webp).
 * Real, licensed people/scene photos (construction site, factory floor,
 * office meeting, retail counter) with a REAL MaterialOS screenshot
 * perspective-composited into each device's screen -- not an
 * AI-generated mockup. The original AI-generated composite this
 * replaced had garbled, fabricated UI text baked into every device
 * screen (e.g. the "MaterialOS" wordmark itself was misspelled) and
 * was rejected outright rather than published; see this repo's git
 * history around 2026-09-14 for the compositing approach (perspective
 * warp of a real /screenshots/*.webp onto hand-picked screen corners,
 * with the person's hand/finger kept in front via an exclusion mask).
 * Inherits the same header/nav staleness noted above, since these crop
 * from the same five screenshots. */
export const PILLAR_PHOTOS = {
  "mobile-first-field-sales": "/photos/pillars/mobile-first-field-sales.webp",
  "real-time-intelligence": "/photos/pillars/real-time-intelligence.webp",
  "one-business-graph": "/photos/pillars/one-business-graph.webp",
  "connected-commerce": "/photos/pillars/connected-commerce.webp",
} as const;
