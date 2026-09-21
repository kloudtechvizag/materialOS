/** Backend sends money as NUMERIC(18,4) strings (B1) -- format for
 * display here, once, rather than every screen rolling its own. */
export function formatINR(amount: string | number): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Same as formatINR but keeps paise -- for financial statements (trial
 * balance, P&L, balance sheet) where rounding to whole rupees would make
 * "does this tie" checks look wrong even when the underlying ledger ties. */
export function formatINRPrecise(amount: string | number): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Lakh/crore-compact form (₹8.42L, ₹1.05Cr) for space-constrained KPI
 * cards, where a compact figure matters more than exact rupees -- every
 * other screen (tables, detail pages, statements) keeps formatINR's full
 * precision. Below 1 lakh, identical to formatINR (compacting a 4-digit
 * number would read as *less* precise, not more compact). */
export function formatINRCompact(amount: string | number): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)}L`;
  return formatINR(value);
}

/** Relative time ("2m ago") off a millisecond timestamp -- shared by
 * the dashboard header's "Updated Xs ago" and the recent-activity feed
 * so the two don't drift into two different rounding rules. */
export function timeAgo(timestamp: number): string {
  if (!timestamp) return "never";
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
