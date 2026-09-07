/** Backend sends money as NUMERIC(18,4) strings (B1) -- format for
 * display here, once, rather than every screen rolling its own. */
export function formatINR(amount: string | number): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
