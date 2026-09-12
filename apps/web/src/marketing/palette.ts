/** Icon-badge color pairs matching the app's established visual
 * language (ADR-017 Suppliers page and every list page built after
 * it) -- cycled by index across a card grid so no two adjacent cards
 * share a color. */
export const ICON_PALETTE = [
  { bg: "#EDE9FE", fg: "#7C3AED" }, // violet
  { bg: "#D1FAE5", fg: "#059669" }, // emerald
  { bg: "#FFEDD5", fg: "#EA580C" }, // coral
  { bg: "#E0F2FE", fg: "#0284C7" }, // sky
  { bg: "#FEF3C7", fg: "#D97706" }, // amber
] as const;

export function paletteColor(index: number) {
  return ICON_PALETTE[index % ICON_PALETTE.length];
}

/** Vibrant gradient version of the same five brand hues, for icon
 * badges on the premium marketing cards (ProductOverviewPage's bento
 * grid, HomePage). Deliberately separate from ICON_PALETTE -- the
 * pastel-bg/solid-fg pairing above is the app-wide list-page language
 * (ADR-017) and stays flat and functional; this one is marketing-only
 * and never used inside the authenticated app. */
export const GRADIENT_PALETTE = [
  { from: "#8B5CF6", to: "#6D28D9" }, // violet
  { from: "#34D399", to: "#059669" }, // emerald
  { from: "#FB923C", to: "#EA580C" }, // coral
  { from: "#38BDF8", to: "#0284C7" }, // sky
  { from: "#FBBF24", to: "#D97706" }, // amber
] as const;

export function paletteGradient(index: number) {
  return GRADIENT_PALETTE[index % GRADIENT_PALETTE.length];
}
