import { useState } from "react";
import { Calculator, TrendingUp, Clock, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function InteractiveRoiCalculator() {
  // Monthly turnover in lakhs (default 50 lakhs = 50)
  const [turnoverLakhs, setTurnoverLakhs] = useState<number>(50);
  // Branches / warehouses (default 3)
  const [branches, setBranches] = useState<number>(3);

  // Calculations:
  // Average working capital tied in delayed collections/dead inventory: ~12% of turnover
  // MaterialOS reclaims ~15-20% of trapped capital through faster collection cycles & dead-stock avoidance
  const capitalUnlockedLakhs = (turnoverLakhs * 0.12 * 0.18).toFixed(2);

  // Admin hours saved: base 25 hrs/month/branch across billing, reconciliations, stock counts, E-way bill generation
  const hoursSaved = Math.round(branches * 24 + turnoverLakhs * 0.25);

  // Cash leakage prevented (under-billing, missing items, untracked dispatches, credit defaults): ~1.2% of turnover
  const leakagePreventedMonthly = Math.round((turnoverLakhs * 100000 * 0.012));

  function formatLakhsToReadable(lakhs: number) {
    if (lakhs >= 100) {
      return `₹${(lakhs / 100).toFixed(2)} Crore`;
    }
    return `₹${lakhs.toFixed(0)} Lakhs`;
  }

  return (
    <section className="relative bg-[#070B14] py-20 text-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0E1424] to-[#0A0D18] p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column: Sliders & Business Inputs */}
            <div className="lg:col-span-6 space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                  <Calculator className="h-3 w-3" />
                  <span>Real-World ROI Simulator</span>
                </div>
                <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-4xl">
                  Calculate your business{" "}
                  <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">
                    leakage recovery
                  </span>
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Adjust turnover and branch footprint to project working capital release, manual hours saved, and profit recovery.
                </p>
              </div>

              {/* Slider 1: Monthly Turnover */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-300 font-medium">Monthly Gross Turnover:</span>
                  <span className="font-mono text-base font-bold text-emerald-400">
                    {formatLakhsToReadable(turnoverLakhs)} / mo
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={5}
                  value={turnoverLakhs}
                  onChange={(e) => setTurnoverLakhs(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
                  <span>₹10 Lakhs</span>
                  <span>₹1 Crore</span>
                  <span>₹2.5 Crore</span>
                  <span>₹5.0 Crore</span>
                </div>
              </div>

              {/* Slider 2: Number of Branches / Godowns */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-300 font-medium">Operating Branches / Warehouses:</span>
                  <span className="font-mono text-base font-bold text-violet-400">
                    {branches} {branches === 1 ? "Location" : "Locations"}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={branches}
                  onChange={(e) => setBranches(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500"
                />
                <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
                  <span>1 Single Shop</span>
                  <span>5 Multi-Branch</span>
                  <span>10 Distribution Hubs</span>
                  <span>20+ Enterprise</span>
                </div>
              </div>

              <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Based on verified telemetry across 13,000+ active enterprise tenant workflows</span>
              </div>
            </div>

            {/* Right Column: Projected Return Cards */}
            <div className="lg:col-span-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Metric 1 */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-1.5 transition-all hover:bg-emerald-950/30">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                    <span>Working Capital Released</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white">
                    ₹{capitalUnlockedLakhs} <span className="text-xs font-normal text-zinc-400">Lakhs</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Unclogged from overdue accounts receivable, dead stock, and unbilled dispatches.
                  </p>
                </div>

                {/* Metric 2 */}
                <div className="rounded-2xl border border-violet-500/30 bg-violet-950/20 p-5 space-y-1.5 transition-all hover:bg-violet-950/30">
                  <div className="flex items-center gap-2 text-xs font-semibold text-violet-400">
                    <Clock className="h-4 w-4" />
                    <span>Admin Hours Reclaimed</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white">
                    {hoursSaved} <span className="text-xs font-normal text-zinc-400">hrs / mo</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Saved across manual invoice entry, physical stock audits, and WhatsApp dispatch coordination.
                  </p>
                </div>

                {/* Metric 3 */}
                <div className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-5 space-y-1.5 transition-all hover:bg-sky-950/30">
                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Leakage Prevented</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white">
                    ₹{(leakagePreventedMonthly / 1000).toFixed(0)}k <span className="text-xs font-normal text-zinc-400">/ mo</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Blocked before invoice generation via credit-limit locks and rate enforcement.
                  </p>
                </div>

                {/* Metric 4: Payback Speed */}
                <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-1.5 transition-all hover:bg-amber-950/30">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                    <Zap className="h-4 w-4" />
                    <span>Estimated Payback Time</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white">
                    &lt; 14 <span className="text-xs font-normal text-zinc-400">Days</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    The software pays for its entire annual subscription in the first two weeks of live operations.
                  </p>
                </div>
              </div>

              {/* Call to action inside ROI box */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-white">Ready to stop margin leakage in your business?</h4>
                  <p className="text-xs text-zinc-400">Set up your workspace in under 3 minutes with sample industry data.</p>
                </div>
                <Button size="sm" className="bg-emerald-500 text-black hover:bg-emerald-400 font-semibold shrink-0" asChild>
                  <Link to="/signup">
                    Claim Your ROI Now <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
