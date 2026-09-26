import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RoiCalculator } from "@/components/marketing/RoiCalculator";
import { Seo } from "@/components/marketing/Seo";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PlanOut } from "@/lib/subscription";

interface CompareRow {
  limit_key?: string;
  code?: string;
  name?: string;
  category?: string;
  values: Record<string, number | boolean | null>;
}

interface ComparePayload {
  plans: { id: string; slug: string; name: string }[];
  limits: CompareRow[];
  features: CompareRow[];
}

interface AddonOffering {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  monthly_price: string;
  yearly_price: string;
}

const FAQ: { q: string; a: string }[] = [
  { q: "Can I change plans later?", a: "Yes, upgrade or downgrade any time from Settings -> Subscription. Upgrades apply immediately with a pro-rated charge for the rest of your billing period; downgrades are blocked if you're currently over the target plan's limits, so nothing is silently lost." },
  { q: "What happens when my trial ends?", a: "You get a grace period with full access to finish choosing a plan -- nothing is deleted. After the grace period, new activity is restricted until you subscribe." },
  { q: "Do prices include GST?", a: "Prices shown are before GST. Your invoice breaks out CGST+SGST or IGST based on your billing state, same as any Indian tax invoice." },
  { q: "Can I add capabilities without changing my whole plan?", a: "Yes -- add-ons like the Printing & Digital Color Lab Pack or extra users/storage attach to any plan without moving you to a different tier." },
];

function formatPrice(value: string | null): string {
  if (value === null) return "Custom";
  const n = Number(value);
  if (n === 0) return "Free";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function PricingPage() {
  const [yearly, setYearly] = useState(true);
  const [compareOpen, setCompareOpen] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["pricing-plans-public"],
    queryFn: () => apiFetch<PlanOut[]>("/pricing/plans", { auth: false }),
  });
  const { data: compare } = useQuery({
    queryKey: ["pricing-compare"],
    queryFn: () => apiFetch<ComparePayload>("/pricing/compare", { auth: false }),
    enabled: compareOpen,
  });
  const { data: addons } = useQuery({
    queryKey: ["pricing-addons"],
    queryFn: () => apiFetch<AddonOffering[]>("/pricing/addons", { auth: false }),
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title="Pricing -- Plans That Grow With Your Business"
        description="Transparent monthly and yearly pricing for MaterialOS -- start free, add capabilities as your business grows, no forced enterprise plan."
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

      <div className="relative mx-auto max-w-6xl space-y-16 px-6 py-16">
        {/* Hero */}
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-300 backdrop-blur-md">
            <span>Transparent Pricing • Zero Hidden Per-Transaction Surcharges</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.15]">
            One intelligent operating system for{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
              every business.
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-base text-zinc-300 sm:text-lg">
            Sales, inventory, accounting, and operations, tailored to your industry. Start with the essentials, add capabilities as your business grows.
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md">
            <button
              onClick={() => setYearly(false)}
              className={cn(
                "rounded-full px-5 py-2 text-xs font-semibold transition-all",
                !yearly
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-white",
              )}
            >
              Monthly billing
            </button>
            <button
              onClick={() => setYearly(true)}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold transition-all",
                yearly
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-white",
              )}
            >
              <span>Annual billing</span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl bg-white/5" />
            ))}
          </div>
        )}
        {plans && (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {plans.map((plan) => {
              const price = plan.monthly_price === null ? null : yearly ? plan.yearly_price : plan.monthly_price;
              const recommended = plan.slug === "growth";
              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "flex flex-col rounded-2xl backdrop-blur-xl transition-all duration-300",
                    recommended
                      ? "border border-violet-500/50 bg-gradient-to-b from-violet-950/30 to-white/[0.04] shadow-[0_0_35px_rgba(124,58,237,0.25)] hover:border-violet-400"
                      : "border border-white/10 bg-white/[0.02] shadow-lg hover:border-white/20 hover:bg-white/[0.04]",
                  )}
                >
                  <CardHeader className="space-y-1.5 pb-3">
                    {recommended && (
                      <span className="inline-block w-fit rounded-full border border-violet-500/40 bg-violet-500/20 px-2.5 py-0.5 text-[10px] font-bold text-violet-300">
                        Most popular
                      </span>
                    )}
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-zinc-400">{plan.description}</p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <div>
                      <span className="text-2xl font-extrabold text-white">{formatPrice(price)}</span>
                      {price !== null && Number(price) > 0 && (
                        <span className="text-xs text-zinc-400"> / {yearly ? "year" : "month"}</span>
                      )}
                    </div>
                    {plan.trial_days > 0 && (
                      <span className="inline-block w-fit rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        {plan.trial_days}-day free trial
                      </span>
                    )}
                    <ul className="flex-1 space-y-2 text-xs text-zinc-300">
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{plan.limits.users === null ? "Unlimited" : plan.limits.users} users</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{plan.limits.companies === null ? "Unlimited" : plan.limits.companies} compan{plan.limits.companies === 1 ? "y" : "ies"}</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{plan.limits.invoices_per_month == null ? "Unlimited" : plan.limits.invoices_per_month.toLocaleString()} invoices/mo</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{plan.features.length} advanced features</span>
                      </li>
                    </ul>
                    <Button
                      asChild
                      size="sm"
                      className={cn(
                        "w-full rounded-xl font-semibold transition-all",
                        recommended
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:from-violet-500 hover:to-indigo-500"
                          : "border-white/15 bg-white/5 text-white hover:bg-white/10 hover:border-white/30",
                      )}
                    >
                      <Link to={plan.slug === "enterprise" ? "/pricing#enterprise" : "/signup"}>
                        {plan.slug === "enterprise" ? "Talk to sales" : plan.monthly_price === "0.00" ? "Start free" : "Start trial"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ROI calculator */}
        {plans && plans.length > 0 && <RoiCalculator plans={plans} yearly={yearly} />}

        {/* Compare */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-white">Compare Plan Details</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareOpen((v) => !v)}
              className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              {compareOpen ? "Hide" : "Show"} full comparison
            </Button>
          </div>
          {compareOpen && (
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="p-4 text-left font-semibold text-white">Feature</th>
                    {compare?.plans.map((p) => (
                      <th key={p.id} className="p-4 text-left font-semibold text-violet-300">{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compare?.limits.map((row) => (
                    <tr key={row.limit_key} className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
                      <td className="p-4 capitalize text-zinc-300">{row.limit_key?.replace(/_/g, " ")}</td>
                      {compare.plans.map((p) => (
                        <td key={p.id} className="p-4 text-zinc-300">
                          {row.values[p.id] === null ? "Unlimited" : row.values[p.id]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {compare?.features.map((row) => (
                    <tr key={row.code} className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
                      <td className="p-4 text-zinc-300">{row.name}</td>
                      {compare.plans.map((p) => (
                        <td key={p.id} className="p-4">
                          {row.values[p.id] ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Minus className="h-4 w-4 text-zinc-600" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add-ons */}
        {addons && addons.length > 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Modular Capability Packs</h2>
              <p className="text-sm text-zinc-400 mt-1">
                One platform, one subscription -- attach specialized capabilities on top of any tier.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {addons.map((addon) => (
                <Card key={addon.id} className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl transition-all hover:border-violet-500/40">
                  <CardContent className="space-y-2 p-6">
                    <p className="font-bold text-white text-base">{addon.name}</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{addon.description}</p>
                    <p className="text-sm font-bold text-violet-300 pt-2">
                      {formatPrice(yearly ? addon.yearly_price : addon.monthly_price)}
                      <span className="text-xs font-normal text-zinc-500"> / {yearly ? "yr" : "mo"}</span>
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Enterprise Card */}
        <Card id="enterprise" className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0B0F19] to-[#04070E] shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
              Custom Enterprise Tier
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Need Dedicated Deployment & SLAs?</h2>
            <p className="max-w-lg text-sm text-zinc-300 leading-relaxed">
              Custom user tiers, dedicated database instances, custom tax jurisdiction rules, SSO/SCIM integrations, and a named solutions architect.
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
                <summary className="cursor-pointer select-none font-semibold text-white transition-colors group-hover:text-violet-300">
                  {item.q}
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
