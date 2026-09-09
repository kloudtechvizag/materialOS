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
