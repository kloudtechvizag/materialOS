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
