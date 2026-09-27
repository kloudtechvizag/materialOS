import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles, ArrowRight, ShieldCheck, ChevronDown, ChevronUp, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRICING_PLANS, COMPARISON_CATEGORIES, type PlanHighlight } from "@/marketing/content/pricingPlans";

export function PricingSection() {
  const [yearly, setYearly] = useState(true);
  const [showFullCompare, setShowFullCompare] = useState(false);

  // We feature the 4 primary commercial tiers in the main grid, plus banners for Free and Professional
  const featuredSlugs = ["starter", "growth", "business", "enterprise"];
  const featuredPlans = featuredSlugs
    .map((slug) => PRICING_PLANS.find((p) => p.slug === slug))
    .filter(Boolean) as PlanHighlight[];

  function formatDisplayPrice(plan: PlanHighlight) {
    if (plan.monthlyPrice === null) return "Custom";
    if (plan.monthlyPrice === 0) return "₹0";
    if (yearly && plan.yearlyPrice) {
      const monthlyEffective = Math.round(plan.yearlyPrice / 12);
      return `₹${monthlyEffective.toLocaleString("en-IN")}`;
    }
    return `₹${plan.monthlyPrice.toLocaleString("en-IN")}`;
  }

  function getPeriodLabel(plan: PlanHighlight) {
    if (plan.monthlyPrice === null) return "billed annually";
    if (plan.monthlyPrice === 0) return "free forever";
    return yearly ? "/ mo (billed annually)" : "/ month";
  }

  return (
    <section id="pricing" className="relative bg-[#070B14] py-24 text-white border-t border-white/5 overflow-hidden">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[1000px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.18)_0%,rgba(59,130,246,0.08)_40%,transparent_70%)] blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold text-violet-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span>Transparent, High-ROI Pricing</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
            Predictable plans that{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
              scale with your operations
            </span>
          </h2>
          <p className="text-base text-zinc-300 sm:text-lg max-w-2xl mx-auto">
            Zero hidden transaction surcharges. No forced implementation lock-in. Full GST compliance & 14-day free trial on every tier.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-4 flex items-center justify-center">
            <div className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-xl shadow-lg">
              <button
                type="button"
                onClick={() => setYearly(false)}
                className={cn(
                  "rounded-xl px-5 py-2 text-xs font-semibold transition-all",
                  !yearly
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setYearly(true)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold transition-all",
                  yearly
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <span>Annual Billing</span>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Free Plan Quick Banner */}
        <div className="mt-10 mx-auto max-w-3xl rounded-2xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs backdrop-blur-md">
          <div className="flex items-center gap-2 text-zinc-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Looking for a Free Tier?</strong> We offer MaterialOS Free for micro-businesses: 2 users, 1 branch, 500 invoices/month at ₹0 forever.
            </span>
          </div>
          <Link
            to="/signup"
            className="text-emerald-300 hover:text-emerald-200 font-semibold underline underline-offset-4 flex items-center gap-1 shrink-0"
          >
            Start Free Forever <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* 4-Card Pricing Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {featuredPlans.map((plan) => {
            const isPopular = plan.popular;
            return (
              <div
                key={plan.slug}
                className={cn(
                  "relative flex flex-col justify-between rounded-3xl border p-7 transition-all duration-300 backdrop-blur-xl",
                  isPopular
                    ? "border-violet-500/60 bg-gradient-to-b from-[#131028] via-[#0D1222] to-[#0A0D18] shadow-[0_0_40px_-10px_rgba(124,58,237,0.4)] lg:-translate-y-2 ring-1 ring-violet-500/50"
                    : "border-white/10 bg-[#0B0F19]/90 hover:border-white/20 hover:bg-[#0D1322]"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 px-3.5 py-1 text-[11px] font-bold text-white shadow-lg tracking-wide uppercase">
                    Most Popular Choice
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-extrabold text-white">{plan.name}</h3>
                    {plan.badge && !isPopular && (
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-zinc-400 leading-relaxed min-h-[38px]">{plan.description}</p>

                  {/* Price */}
                  <div className="mt-6 flex items-baseline gap-1.5 pb-4 border-b border-white/10">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      {formatDisplayPrice(plan)}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">{getPeriodLabel(plan)}</span>
                  </div>

                  {/* Capacity & Resource Limits */}
                  <div className="mt-5 space-y-2 rounded-xl bg-white/[0.03] p-3 text-xs border border-white/5">
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-400">Users Included:</span>
                      <span className="font-semibold text-white">
                        {plan.limits.users === null ? "Unlimited" : `${plan.limits.users} users`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-400">Branches & Godowns:</span>
                      <span className="font-semibold text-white">
                        {plan.limits.branches === null
                          ? "Unlimited"
                          : `${plan.limits.branches} Branch / ${plan.limits.warehouses} Godowns`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-400">Monthly Invoices:</span>
                      <span className="font-semibold text-white">
                        {plan.limits.invoicesPerMonth === null
                          ? "Unlimited"
                          : `${plan.limits.invoicesPerMonth.toLocaleString()} / mo`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-400">Catalog Capacity:</span>
                      <span className="font-semibold text-white">
                        {plan.limits.items === null
                          ? "Unlimited items"
                          : `${plan.limits.items.toLocaleString()} items`}
                      </span>
                    </div>
                  </div>

                  {/* Key Feature Highlights */}
                  <div className="mt-6 space-y-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Key Capabilities Included:
                    </span>
                    <ul className="space-y-2 text-xs text-zinc-300">
                      {plan.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card CTA */}
                <div className="pt-8">
                  <Button
                    className={cn(
                      "w-full rounded-xl py-5 font-semibold text-xs sm:text-sm transition-all duration-200",
                      isPopular
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                        : "border border-white/15 bg-white/5 text-white hover:bg-white/10 hover:border-white/30"
                    )}
                    asChild
                  >
                    <Link to={plan.ctaHref}>
                      {plan.ctaText} <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Professional Tier Mention & Comparison Toggle */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-2 text-sky-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Need AI Copilot, 100+ Team Users & Priority SLA?</h4>
              <p className="text-xs text-zinc-400">
                Explore the <strong>Professional Plan</strong> (₹17,999/mo) with AI demand forecasting and 1 TB storage, or compare all 6 plans side-by-side.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullCompare((prev) => !prev)}
              className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              {showFullCompare ? <ChevronUp className="mr-1.5 h-4 w-4" /> : <ChevronDown className="mr-1.5 h-4 w-4" />}
              {showFullCompare ? "Hide Feature Matrix" : "View Feature Comparison Matrix"}
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-violet-600 text-white hover:bg-violet-500"
              asChild
            >
              <Link to="/pricing">
                Full Pricing Page <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Expandable Comparison Matrix on Landing Page */}
        {showFullCompare && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-[#0B0F19] p-6 sm:p-8 backdrop-blur-2xl shadow-2xl overflow-x-auto transition-all animate-in fade-in-50 duration-300">
            <div className="flex items-center justify-between pb-6 border-b border-white/10">
              <div>
                <h3 className="text-xl font-bold text-white">Side-by-Side Plan Comparison</h3>
                <p className="text-xs text-zinc-400 mt-1">Detailed feature grants, module gates, and operational limits.</p>
              </div>
              <span className="text-xs text-violet-300 font-medium">All 6 Platform Tiers Included</span>
            </div>

            <table className="w-full min-w-[760px] text-xs mt-4">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400">
                  <th className="py-3 px-4 text-left font-semibold text-white w-1/3">Capability / Limit</th>
                  <th className="py-3 px-3 text-center font-semibold text-zinc-300">Free</th>
                  <th className="py-3 px-3 text-center font-semibold text-zinc-300">Starter</th>
                  <th className="py-3 px-3 text-center font-semibold text-violet-400 font-bold">Growth</th>
                  <th className="py-3 px-3 text-center font-semibold text-zinc-300">Business</th>
                  <th className="py-3 px-3 text-center font-semibold text-zinc-300">Professional</th>
                  <th className="py-3 px-3 text-center font-semibold text-zinc-300">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_CATEGORIES.map((cat, catIdx) => (
                  <tr key={catIdx} className="contents">
                    <td
                      colSpan={7}
                      className="bg-white/[0.04] py-2.5 px-4 font-bold text-violet-300 uppercase tracking-wider text-[11px] border-t border-b border-white/10"
                    >
                      {cat.category}
                    </td>
                    {cat.items.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-4 text-zinc-200 font-medium">{row.name}</td>
                        {["free", "starter", "growth", "business", "professional", "enterprise"].map((slug) => {
                          const val = row.values[slug];
                          return (
                            <td key={slug} className="py-3 px-3 text-center text-zinc-300">
                              {typeof val === "boolean" ? (
                                val ? (
                                  <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                                ) : (
                                  <span className="text-zinc-600 font-mono text-base">—</span>
                                )
                              ) : (
                                <span className={slug === "growth" ? "font-bold text-white" : ""}>
                                  {val ?? "—"}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Security & Money-Back Notice */}
        <div className="mt-12 text-center text-xs text-zinc-400 flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>14-day free trial on all paid plans</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Pro-rated upgrades & downgrades anytime</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-sky-400" />
            <span>GST & Tax Invoice ready on day one</span>
          </div>
        </div>
      </div>
    </section>
  );
}
