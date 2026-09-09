/** Real screenshots (apps/web/public/screenshots/*.webp, captured from
 * the actual running app against the sribalaji-demo tenant) for the
 * features where a clean one exists. Partial by design -- not every
 * feature has one yet, and cards for the rest fall back to the icon
 * badge alone rather than a placeholder image. */
export const FEATURE_SCREENSHOTS: Record<string, string> = {
  "inventory-management": "/screenshots/inventory.webp",
  "sales-quotation-management": "/screenshots/quotations.webp",
  "credit-management": "/screenshots/customers.webp",
  "report-builder": "/screenshots/reports.webp",
};
