import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, Sparkles, ChevronDown, ChevronUp, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RoiCalculator } from "@/components/marketing/RoiCalculator";
import { Seo } from "@/components/marketing/Seo";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PlanOut } from "@/lib/subscription";
import {
  PRICING_PLANS,
  FALLBACK_PLANS_OUT,
  COMPARISON_CATEGORIES,
  ADDON_PACKS,
} from "@/marketing/content/pricingPlans";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Can I change plans later?",
    a: "Yes, upgrade or downgrade any time from Settings -> Subscription. Upgrades apply immediately with a pro-rated charge for the rest of your billing period; downgrades are validated against your current usage so nothing is silently deleted or corrupted.",
  },
  {
    q: "What happens when my trial ends?",
    a: "You get a grace period with full access to finish choosing a plan -- nothing is deleted. After the grace period, new activity is restricted until you choose a subscription tier.",
  },
  {
    q: "Do prices include GST?",
    a: "Prices shown are before GST. Your invoice breaks out CGST+SGST or IGST based on your billing state, exactly the same as any standard Indian tax invoice.",
  },
  {
    q: "Can I add capabilities without changing my whole plan?",
    a: "Yes -- modular capability packs like the Printing & Digital Color Lab Pack, School Management Pack, or extra users/storage attach to any tier without forcing you to move to a higher base plan.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes! MaterialOS Free includes 2 users, 1 branch, and up to 500 invoices per month with full core GST billing and inventory ledger capabilities at ₹0 forever.",
  },
];

function formatPrice(value: string | number | null): string {
  if (value === null) return "Custom";
  const n = Number(value);
  if (n === 0) return "Free";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function PricingPage() {
  const [yearly, setYearly] = useState(true);
  const [compareOpen, setCompareOpen] = useState(false);

  // Use authoritative fallback plans as initialData so cards are NEVER blank or missing
  const { data: plans = FALLBACK_PLANS_OUT } = useQuery({
    queryKey: ["pricing-plans-public"],
    queryFn: () => apiFetch<PlanOut[]>("/pricing/plans", { auth: false }),
    initialData: FALLBACK_PLANS_OUT,
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title="Pricing -- Plans That Grow With Your Business"
        description="Transparent monthly and yearly pricing for MaterialOS -- start free, add capabilities as your business grows, zero hidden surcharges."
        path="/pricing"
      />

      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[550px] w-[900px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.25)_0%,rgba(59,130,246,0.12)_45%,transparent_75%)] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl space-y-16 px-6 py-16">
        {/* Hero */}
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span>Transparent Pricing • Zero Hidden Per-Transaction Surcharges</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.15]">
            One intelligent operating system for{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
              every business.
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-zinc-300 sm:text-lg">
            Sales, inventory, accounting, and operations tailored to your industry. Start with the essentials, add capabilities as your turnover grows.
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-md shadow-lg">
            <button
              onClick={() => setYearly(false)}
              className={cn(
                "rounded-xl px-5 py-2 text-xs font-semibold transition-all",
                !yearly
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              Monthly billing
            </button>
            <button
              onClick={() => setYearly(true)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold transition-all",
                yearly
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <span>Annual billing</span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards Grid: 6 Tiers with Full Details */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 items-stretch">
          {plans.map((plan) => {
            const rawPrice = yearly ? plan.yearly_price : plan.monthly_price;
            const displayPrice =
              yearly && plan.yearly_price && Number(plan.yearly_price) > 0
                ? Math.round(Number(plan.yearly_price) / 12)
                : rawPrice;

            const recommended = plan.slug === "growth";
            const planHighlight = PRICING_PLANS.find((p) => p.slug === plan.slug);

            return (
              <Card
                key={plan.id || plan.slug}
                className={cn(
                  "flex flex-col justify-between rounded-3xl backdrop-blur-xl transition-all duration-300 relative",
                  recommended
                    ? "border-2 border-violet-500 bg-gradient-to-b from-[#181335] via-[#0E1324] to-[#080B14] shadow-[0_0_40px_rgba(124,58,237,0.35)] xl:-translate-y-2 ring-1 ring-violet-400/50"
                    : "border border-white/10 bg-[#0B0F19]/90 shadow-lg hover:border-white/20 hover:bg-[#0E1424]"
                )}
              >
                {recommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wider">
                    Most Popular
                  </span>
                )}

                <div>
                  <CardHeader className="space-y-1.5 p-5 pb-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-extrabold text-white">{plan.name}</h3>
                      {planHighlight?.badge && !recommended && (
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-medium text-zinc-400">
                          {planHighlight.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 min-h-[34px] leading-snug">{plan.description}</p>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4">
                    {/* Price Header */}
                    <div className="pb-3 border-b border-white/10">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-black text-white">
                          {formatPrice(displayPrice)}
                        </span>
                        {rawPrice !== null && Number(rawPrice) > 0 && (
                          <span className="text-[11px] text-zinc-400 font-medium">
                            {yearly ? "/ mo (billed yr)" : "/ mo"}
                          </span>
                        )}
                      </div>
                      {plan.trial_days > 0 ? (
                        <span className="inline-block mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          {plan.trial_days}-day free trial
                        </span>
                      ) : Number(rawPrice) === 0 ? (
                        <span className="inline-block mt-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                          Free forever
                        </span>
                      ) : (
                        <span className="inline-block mt-2 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                          Custom agreement
                        </span>
                      )}
                    </div>

                    {/* Operational Limits Box */}
                    <div className="space-y-1.5 rounded-xl bg-white/[0.03] p-2.5 text-[11px] border border-white/5 text-zinc-300">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Users:</span>
                        <span className="font-semibold text-white">
                          {plan.limits.users === null ? "Unlimited" : `${plan.limits.users} users`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Branches:</span>
                        <span className="font-semibold text-white">
                          {plan.limits.branches === null ? "Unlimited" : `${plan.limits.branches} Branch`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Godowns:</span>
                        <span className="font-semibold text-white">
                          {plan.limits.warehouses === null ? "Unlimited" : `${plan.limits.warehouses} Godowns`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Invoices:</span>
                        <span className="font-semibold text-white">
                          {plan.limits.invoices_per_month === null
                            ? "Unlimited"
                            : `${plan.limits.invoices_per_month.toLocaleString()} / mo`}
                        </span>
                      </div>
                    </div>

                    {/* Feature Highlights */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Capabilities Included:
                      </span>
                      <ul className="space-y-1.5 text-xs text-zinc-300">
                        {(planHighlight?.features || plan.features.slice(0, 5)).map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-tight text-[11px]">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </div>

                <div className="p-5 pt-0">
                  <Button
                    asChild
                    size="sm"
                    className={cn(
                      "w-full rounded-xl font-semibold text-xs py-4 transition-all",
                      recommended
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:from-violet-500 hover:to-indigo-500"
                        : "border-white/15 bg-white/5 text-white hover:bg-white/10 hover:border-white/30"
                    )}
                  >
                    <Link
                      to={
                        plan.slug === "enterprise"
                          ? "/book-demo"
                          : `/signup?plan=${plan.slug}&billing=${yearly ? "yearly" : "monthly"}`
                      }
                    >
                      {plan.slug === "enterprise"
                        ? "Talk to Sales"
                        : plan.monthly_price === "0.00" || plan.slug === "free"
                        ? "Start Free"
                        : "Start 14-Day Trial"}
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* ROI Calculator */}
        <RoiCalculator plans={plans} yearly={yearly} />

        {/* Comprehensive Feature Comparison Matrix */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Compare Plan Details & Feature Matrix</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Detailed side-by-side limits, module entitlement gates, and support SLAs.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareOpen((v) => !v)}
              className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 shrink-0"
            >
              {compareOpen ? <ChevronUp className="mr-1.5 h-4 w-4" /> : <ChevronDown className="mr-1.5 h-4 w-4" />}
              {compareOpen ? "Hide Detailed Comparison" : "Show Full Feature Matrix"}
            </Button>
          </div>

          {compareOpen && (
            <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[#0B0F19] p-6 backdrop-blur-xl shadow-2xl transition-all animate-in fade-in-50 duration-300">
              <table className="w-full min-w-[760px] text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-400">
                    <th className="p-3.5 text-left font-semibold text-white w-1/3">Capability / Resource</th>
                    <th className="p-3.5 text-center font-semibold text-zinc-300">Free</th>
                    <th className="p-3.5 text-center font-semibold text-zinc-300">Starter</th>
                    <th className="p-3.5 text-center font-semibold text-violet-400 font-bold">Growth</th>
                    <th className="p-3.5 text-center font-semibold text-zinc-300">Business</th>
                    <th className="p-3.5 text-center font-semibold text-zinc-300">Professional</th>
                    <th className="p-3.5 text-center font-semibold text-zinc-300">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_CATEGORIES.map((cat, catIdx) => (
                    <tr key={catIdx} className="contents">
                      <td
                        colSpan={7}
                        className="bg-white/[0.04] py-3 px-4 font-bold text-violet-300 uppercase tracking-wider text-[11px] border-t border-b border-white/10"
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
        </div>

        {/* Modular Capability Packs (Add-ons) */}
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300 mb-2">
              <Layers className="h-3 w-3" />
              <span>Modular Capability Packs</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Attach Specialized Capabilities to Any Tier
            </h2>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              One platform, one unified subscription. Upgrade only what your business specifically needs without jumping to an expensive blanket enterprise tier.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADDON_PACKS.map((addon) => (
              <Card
                key={addon.code}
                className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl transition-all hover:border-violet-500/40 hover:bg-white/[0.04]"
              >
                <CardContent className="space-y-3 p-6">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                      {addon.category}
                    </span>
                    <span className="text-sm font-bold text-violet-300">
                      {formatPrice(yearly ? Math.round(addon.yearlyPrice / 12) : addon.monthlyPrice)}
                      <span className="text-xs font-normal text-zinc-500"> / mo</span>
                    </span>
                  </div>
                  <p className="font-bold text-white text-base">{addon.name}</p>
                  <p className="text-xs text-zinc-400 leading-relaxed min-h-[36px]">{addon.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Enterprise Custom Deployment Card */}
        <Card id="enterprise" className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0B0F19] to-[#04070E] shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-sky-300">
              Custom Enterprise Tier
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Need Dedicated Deployment & SLAs?</h2>
            <p className="max-w-xl text-sm text-zinc-300 leading-relaxed">
              Custom user tiers, dedicated database instances, custom tax jurisdiction rules, SSO/SCIM integrations, and a named solutions architect with 15-minute SLA.
            </p>
            <Button
              size="lg"
              className="mt-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 font-semibold text-white shadow-lg hover:from-violet-500 hover:to-indigo-500"
              asChild
            >
              <Link to="/book-demo">Talk With Enterprise Engineering</Link>
            </Button>
          </CardContent>
        </Card>

        {/* FAQ */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md transition-all hover:border-violet-500/30"
              >
                <summary className="cursor-pointer select-none font-semibold text-white transition-colors group-hover:text-violet-300 flex items-center justify-between">
                  <span>{item.q}</span>
                  <ChevronDown className="h-4 w-4 text-zinc-400 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
