/**
 * Guards against a real bug class this session found twice: an
 * IndustryProfile module key (VALID_MODULES, kept in sync with the
 * backend's own copy in apps/api/tests/test_industry_profile.py) that
 * some profile enables but that gates zero sidebar items -- toggling it
 * has no visible effect anywhere ("warehouse" and, briefly, "credit"
 * before this check existed). Run via `npm run check:nav-modules`; also
 * safe to wire into CI since it exits non-zero on a real gap.
 *
 * Uses Vite's own SSR module graph (same as scripts/prerender.mjs) to
 * import the real NAVIGATION_CONFIG array rather than regex-parsing
 * navigation.ts, so it can't drift from what the app actually renders.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Mirrors apps/api/tests/test_industry_profile.py's VALID_MODULES --
// keep both in sync when a profile gains a genuinely new module key.
const VALID_MODULES = new Set([
  "sales", "purchase", "inventory", "warehouse", "dispatch", "fleet", "credit",
  "collections", "projects", "field_sales", "accounting", "gst", "pos", "printing",
  "laboratory", "jewellery", "serial_tracking", "education",
]);

// Modules that deliberately gate no sidebar item because the feature
// they describe lives as a field/behavior on an already-universal page
// rather than as its own menu entry -- documented here so this check
// can tell "known, reviewed exception" apart from "newly orphaned".
const ALLOWED_ORPHANS = new Set([
  // Customer.credit_limit/credit_days are real fields already shown on
  // the (always-visible, ungated) Customers and Customer 360 pages --
  // "credit" describes that capability, not a distinct menu section.
  "credit",
]);

async function main() {
  const server = await createServer({ root, appType: "custom", server: { middlewareMode: true } });
  const { NAVIGATION_CONFIG } = await server.ssrLoadModule("/src/lib/navigation.ts");
  // ADR-048: the settings workspace has its own module-gated item
  // registry (Webhooks/Receipts/Metal rates/Import-from-Tally, moved
  // out of the main sidebar's Setup section into the unified /settings
  // workspace) -- a real second source of nav items this guard must
  // also scan, or a module gated only from here reads as a false orphan.
  const { SETTINGS_CATEGORIES } = await server.ssrLoadModule("/src/lib/settingsNav.ts");
  await server.close();

  const gatedModules = new Set();
  for (const section of [...NAVIGATION_CONFIG, ...SETTINGS_CATEGORIES]) {
    for (const item of section.items) {
      if (item.module) gatedModules.add(item.module);
    }
  }

  const orphans = [...VALID_MODULES].filter((m) => !gatedModules.has(m) && !ALLOWED_ORPHANS.has(m));

  if (orphans.length > 0) {
    console.error(
      `Module(s) enabled by some industry profile but gating zero sidebar items: ${orphans.join(", ")}\n` +
        `Either add a nav item with module: "<name>" in lib/navigation.ts, or add it to ` +
        `ALLOWED_ORPHANS in this script with a comment explaining where the capability actually lives.`
    );
    process.exit(1);
  }

  console.log(`OK: every enabled module (except documented orphans: ${[...ALLOWED_ORPHANS].join(", ") || "none"}) gates at least one sidebar item.`);
}

main();
