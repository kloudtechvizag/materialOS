import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlanOut } from "@/lib/subscription";

interface RoiCalculatorProps {
  plans: PlanOut[];
  yearly: boolean;
}

interface FormState {
  teamMembers: string;
  invoicesPerMonth: string;
  purchasesPerMonth: string;
  collectionsHours: string;
  reportingHours: string;
  inventoryHours: string;
  hourlyCost: string;
}

const DEFAULTS: FormState = {
  teamMembers: "3",
  invoicesPerMonth: "100",
  purchasesPerMonth: "40",
  collectionsHours: "8",
  reportingHours: "6",
  inventoryHours: "6",
  hourlyCost: "250",
};

// Every assumption below is shown to the user, not hidden in the math --
// these are stated, editable-in-spirit estimates (the one number users can
// actually tune is their own hourly cost), not a claim of measured fact.
const MINUTES_SAVED_PER_INVOICE = 5;
const MINUTES_SAVED_PER_PURCHASE_ENTRY = 4;
const COLLECTIONS_TIME_REDUCTION = 0.3;
const REPORTING_TIME_REDUCTION = 0.7;
const INVENTORY_TIME_REDUCTION = 0.4;

function n(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function recommendPlan(plans: PlanOut[], teamMembers: number, invoicesPerMonth: number): PlanOut | null {
  const candidates = plans
    .filter((p) => p.is_public)
    .filter((p) => (p.limits.users == null || p.limits.users >= teamMembers))
    .filter((p) => (p.limits.invoices_per_month == null || p.limits.invoices_per_month >= invoicesPerMonth))
    .sort((a, b) => a.tier_order - b.tier_order);
  if (candidates.length > 0) return candidates[0];
  const publicPlans = plans.filter((p) => p.is_public).sort((a, b) => b.tier_order - a.tier_order);
  return publicPlans[0] ?? null;
}

export function RoiCalculator({ plans, yearly }: RoiCalculatorProps) {
  const [form, setForm] = useState<FormState>(DEFAULTS);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const result = useMemo(() => {
    const teamMembers = n(form.teamMembers);
    const invoices = n(form.invoicesPerMonth);
    const purchases = n(form.purchasesPerMonth);
    const hourlyCost = n(form.hourlyCost);

    const invoiceHoursSaved = (invoices * MINUTES_SAVED_PER_INVOICE) / 60;
    const purchaseHoursSaved = (purchases * MINUTES_SAVED_PER_PURCHASE_ENTRY) / 60;
    const collectionsHoursSaved = n(form.collectionsHours) * COLLECTIONS_TIME_REDUCTION;
    const reportingHoursSaved = n(form.reportingHours) * REPORTING_TIME_REDUCTION;
    const inventoryHoursSaved = n(form.inventoryHours) * INVENTORY_TIME_REDUCTION;

    const totalHoursSaved = invoiceHoursSaved + purchaseHoursSaved + collectionsHoursSaved + reportingHoursSaved + inventoryHoursSaved;
    const estimatedMonthlyValue = totalHoursSaved * hourlyCost;

    const plan = recommendPlan(plans, teamMembers, invoices);
    let monthlyCost: number | null = null;
    if (plan) {
      if (yearly && plan.yearly_price !== null) monthlyCost = Number(plan.yearly_price) / 12;
      else if (!yearly && plan.monthly_price !== null) monthlyCost = Number(plan.monthly_price);
    }
    const valueMultiple = monthlyCost !== null && monthlyCost > 0 ? estimatedMonthlyValue / monthlyCost : null;

    return { totalHoursSaved, estimatedMonthlyValue, plan, monthlyCost, valueMultiple };
  }, [form, plans, yearly]);

  const fields: { key: keyof FormState; label: string }[] = [
    { key: "teamMembers", label: "People doing billing / admin work" },
    { key: "invoicesPerMonth", label: "Invoices created per month" },
    { key: "purchasesPerMonth", label: "Purchase entries per month" },
    { key: "collectionsHours", label: "Hours/month chasing overdue payments" },
    { key: "reportingHours", label: "Hours/month on manual reporting" },
    { key: "inventoryHours", label: "Hours/month on inventory tracking" },
    { key: "hourlyCost", label: "Your team's average hourly cost (₹)" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-xl font-semibold">What could MaterialOS be worth to your business?</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        An estimate based on the numbers you enter below -- not a guarantee. Adjust the hourly cost to match your own team.
      </p>

      <Card>
        <CardContent className="grid gap-6 pt-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs font-normal text-muted-foreground">{f.label}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="hidden w-px bg-border lg:block" />

          <div className="flex flex-col justify-center gap-4 rounded-lg bg-muted/40 p-5">
            <div>
              <p className="text-xs text-muted-foreground">Estimated monthly value</p>
              <p className="text-2xl font-bold tabular-nums">
                ₹{Math.round(result.estimatedMonthlyValue).toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-muted-foreground">≈ {result.totalHoursSaved.toFixed(1)} hours/month saved</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Suggested plan &amp; cost</p>
              <p className="text-lg font-semibold">
                {result.plan?.name ?? "--"}
                {result.monthlyCost !== null && (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    (≈ ₹{Math.round(result.monthlyCost).toLocaleString("en-IN")}/mo{yearly ? ", billed yearly" : ""})
                  </span>
                )}
                {result.monthlyCost === null && result.plan && (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">(custom pricing)</span>
                )}
              </p>
            </div>
            {result.valueMultiple !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Potential value multiple</p>
                <p className="text-2xl font-bold tabular-nums text-primary">{result.valueMultiple.toFixed(1)}×</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Estimate assumes ~{MINUTES_SAVED_PER_INVOICE} minutes saved per invoice and ~{MINUTES_SAVED_PER_PURCHASE_ENTRY} minutes
        per purchase entry from faster billing and automatic stock updates; {Math.round(COLLECTIONS_TIME_REDUCTION * 100)}% less
        time chasing overdue payments with prioritized collections; {Math.round(REPORTING_TIME_REDUCTION * 100)}% less manual
        reporting time with instant reports; and {Math.round(INVENTORY_TIME_REDUCTION * 100)}% less inventory reconciliation
        time with real-time stock visibility. Your actual results depend on your business.
      </p>
    </div>
  );
}
