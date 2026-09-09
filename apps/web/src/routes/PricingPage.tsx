import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="mx-auto max-w-6xl space-y-16 px-6 py-16">
      <Seo
        title="Pricing -- Plans That Grow With Your Business"
        description="Transparent monthly and yearly pricing for MaterialOS -- start free, add capabilities as your business grows, no forced enterprise plan."
        path="/pricing"
      />
      {/* Hero */}
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">One intelligent operating system for every business.</h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Sales, inventory, accounting, and operations, tailored to your industry. Start with the essentials, add capabilities as your business grows.
        </p>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setYearly(false)}
          className={cn("rounded-md px-3 py-1.5 text-sm font-medium", !yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
        >
          Monthly
        </button>
        <button
          onClick={() => setYearly(true)}
          className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium", yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
        >
          Yearly <Badge variant={yearly ? "outline" : "secondary"} className={yearly ? "border-primary-foreground/40 text-primary-foreground" : ""}>Save 20%</Badge>
        </button>
      </div>

      {/* Plan cards */}
      {isLoading && <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-80" />)}</div>}
      {plans && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {plans.map((plan) => {
            const price = plan.monthly_price === null ? null : yearly ? plan.yearly_price : plan.monthly_price;
            const recommended = plan.slug === "growth";
            return (
              <Card key={plan.id} className={cn("flex flex-col", recommended && "border-primary shadow-md")}>
                <CardHeader className="space-y-1 pb-3">
                  {recommended && <Badge className="w-fit">Most popular</Badge>}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div>
                    <span className="text-2xl font-bold">{formatPrice(price)}</span>
                    {price !== null && Number(price) > 0 && (
                      <span className="text-xs text-muted-foreground"> / {yearly ? "year" : "month"}</span>
                    )}
                  </div>
                  {plan.trial_days > 0 && <p className="text-xs text-muted-foreground">{plan.trial_days}-day free trial</p>}
                  <ul className="flex-1 space-y-1.5 text-xs text-muted-foreground">
                    <li>{plan.limits.users === null ? "Unlimited" : plan.limits.users} users</li>
                    <li>{plan.limits.companies === null ? "Unlimited" : plan.limits.companies} compan{plan.limits.companies === 1 ? "y" : "ies"}</li>
                    <li>{plan.limits.invoices_per_month === null ? "Unlimited" : plan.limits.invoices_per_month.toLocaleString()} invoices/mo</li>
                    <li>{plan.features.length} advanced features</li>
                  </ul>
                  <Button asChild variant={recommended ? "default" : "outline"} size="sm" className="w-full">
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

      {/* Compare */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Compare plans</h2>
          <Button variant="outline" size="sm" onClick={() => setCompareOpen((v) => !v)}>
            {compareOpen ? "Hide" : "Show"} full comparison
          </Button>
        </div>
        {compareOpen && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-3 text-left font-medium">Feature</th>
                  {compare?.plans.map((p) => <th key={p.id} className="p-3 text-left font-medium">{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {compare?.limits.map((row) => (
                  <tr key={row.limit_key} className="border-b border-border last:border-0">
                    <td className="p-3 capitalize text-muted-foreground">{row.limit_key?.replace(/_/g, " ")}</td>
                    {compare.plans.map((p) => (
                      <td key={p.id} className="p-3">{row.values[p.id] === null ? "Unlimited" : row.values[p.id]}</td>
                    ))}
                  </tr>
                ))}
                {compare?.features.map((row) => (
                  <tr key={row.code} className="border-b border-border last:border-0">
                    <td className="p-3 text-muted-foreground">{row.name}</td>
                    {compare.plans.map((p) => (
                      <td key={p.id} className="p-3">
                        {row.values[p.id] ? <Check className="h-4 w-4 text-emerald-600" /> : <Minus className="h-4 w-4 text-muted-foreground/40" />}
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
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Add capabilities without changing plans</h2>
            <p className="text-sm text-muted-foreground">One platform, one subscription -- add what your business needs on top of any plan.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {addons.map((addon) => (
              <Card key={addon.id}>
                <CardContent className="space-y-1.5 pt-6">
                  <p className="font-medium">{addon.name}</p>
                  <p className="text-xs text-muted-foreground">{addon.description}</p>
                  <p className="text-sm font-semibold">
                    {formatPrice(yearly ? addon.yearly_price : addon.monthly_price)}
                    <span className="text-xs font-normal text-muted-foreground"> / {yearly ? "yr" : "mo"}</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Enterprise */}
      <Card id="enterprise" className="bg-muted/30">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <h2 className="text-xl font-semibold">Need something custom?</h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Custom users, companies, and API limits, SSO/SCIM, advanced RBAC, dedicated support with an SLA, and private deployment options where applicable.
          </p>
          <Button asChild>
            <a href="mailto:sales@materialos.example.com">Talk to sales</a>
          </Button>
        </CardContent>
      </Card>

      {/* FAQ */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="rounded-lg border border-border p-4">
              <summary className="cursor-pointer select-none font-medium">{item.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
