import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, CreditCard, FileText, RotateCcw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSubscription, type PlanOut, type SubscriptionOut } from "@/lib/subscription";

interface UsageRow {
  limit_key: string;
  used: string;
  limit: number | null;
  enforced: boolean;
}

interface SubscriptionInvoice {
  id: string;
  invoice_number: string;
  status: string;
  total: string;
  currency: string;
  due_at: string;
}

interface SubscriptionChangeOut {
  subscription: SubscriptionOut;
  invoice: SubscriptionInvoice | null;
}

interface CheckoutOut {
  payment: { id: string };
  order_id: string;
  amount: number;
  currency: string;
  is_sandbox: boolean;
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  trialing: "secondary",
  active: "success",
  past_due: "destructive",
  grace_period: "destructive",
  paused: "outline",
  cancelled: "outline",
  expired: "destructive",
  suspended: "destructive",
};

function usageBarColor(ratio: number): string {
  if (ratio >= 1) return "bg-destructive";
  if (ratio >= 0.9) return "bg-destructive/70";
  if (ratio >= 0.75) return "bg-amber-500";
  return "bg-primary";
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** Settings -> Subscription (spec sec22-25, sec42's tenant-facing half).
 * Shows what plan you're on, what you're paying, what you're using, and
 * every action (upgrade/downgrade/cancel/reactivate) the backend
 * actually supports -- no hidden billing behavior (spec sec83). */
export function SubscriptionPage() {
  const queryClient = useQueryClient();
  const [pendingInvoice, setPendingInvoice] = useState<SubscriptionInvoice | null>(null);
  const [checkout, setCheckout] = useState<CheckoutOut | null>(null);
  const [planPicker, setPlanPicker] = useState<"upgrade" | "downgrade" | null>(null);

  const { data: subscription, isLoading, error, refetch } = useSubscription();
  const { data: usage } = useQuery({
    queryKey: ["subscription-usage"],
    queryFn: () => apiFetch<UsageRow[]>("/subscription/usage"),
  });
  const { data: plans } = useQuery({
    queryKey: ["pricing-plans"],
    queryFn: () => apiFetch<PlanOut[]>("/pricing/plans"),
    enabled: planPicker !== null,
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
    queryClient.invalidateQueries({ queryKey: ["subscription-usage"] });
    queryClient.invalidateQueries({ queryKey: ["subscription-invoices"] });
  }

  const changePlan = useMutation({
    mutationFn: ({ action, planSlug }: { action: "upgrade" | "downgrade"; planSlug: string }) =>
      apiFetch<SubscriptionChangeOut>(`/subscription/${action}`, { method: "POST", body: { plan_slug: planSlug, billing_cycle: subscription?.billing_cycle ?? "yearly" } }),
    onSuccess: (data) => {
      invalidateAll();
      setPlanPicker(null);
      if (data.invoice) setPendingInvoice(data.invoice);
    },
  });

  const cancel = useMutation({
    mutationFn: (atPeriodEnd: boolean) => apiFetch<SubscriptionOut>("/subscription/cancel", { method: "POST", body: { at_period_end: atPeriodEnd } }),
    onSuccess: invalidateAll,
  });

  const reactivate = useMutation({
    mutationFn: () => apiFetch<SubscriptionChangeOut>("/subscription/reactivate", { method: "POST" }),
    onSuccess: (data) => {
      invalidateAll();
      if (data.invoice) setPendingInvoice(data.invoice);
    },
  });

  const startCheckout = useMutation({
    mutationFn: (invoiceId: string) => apiFetch<CheckoutOut>("/billing/checkout", { method: "POST", body: { invoice_id: invoiceId } }),
    onSuccess: (data) => setCheckout(data),
  });

  const simulate = useMutation({
    mutationFn: (succeed: boolean) => apiFetch(`/billing/checkout/${checkout?.payment.id}/simulate`, { method: "POST", body: { succeed } }),
    onSuccess: () => {
      invalidateAll();
      setPendingInvoice(null);
      setCheckout(null);
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!subscription) return null;

  const isTrialing = subscription.status === "trialing";
  const isLapsed = ["cancelled", "expired", "suspended"].includes(subscription.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Subscription</h1>
          <p className="text-sm text-muted-foreground">Your plan, usage, and billing -- everything here is server-verified, nothing local-only.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/subscription/invoices"><FileText className="h-4 w-4" /> Invoices</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/subscription/payments"><CreditCard className="h-4 w-4" /> Payments</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{subscription.plan.name}</CardTitle>
            <Badge variant={STATUS_VARIANT[subscription.status] ?? "outline"}>{subscription.status.replace(/_/g, " ")}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-2xl font-semibold">
            {subscription.plan.monthly_price === null
              ? "Custom pricing"
              : `₹${Number(subscription.billing_cycle === "yearly" ? subscription.plan.yearly_price : subscription.plan.monthly_price).toLocaleString("en-IN")}`}
            {subscription.plan.monthly_price !== null && (
              <span className="text-sm font-normal text-muted-foreground"> / {subscription.billing_cycle === "yearly" ? "year" : "month"}</span>
            )}
          </p>

          {isTrialing && subscription.trial_ends_at && (
            <p className="text-sm text-muted-foreground">Trial ends in {daysUntil(subscription.trial_ends_at)} day(s), on {new Date(subscription.trial_ends_at).toLocaleDateString()}.</p>
          )}
          {!isTrialing && !isLapsed && (
            <p className="text-sm text-muted-foreground">
              {subscription.cancel_at_period_end ? "Cancels" : "Renews"} on {new Date(subscription.current_period_end).toLocaleDateString()}.
            </p>
          )}
          {subscription.status === "grace_period" && subscription.grace_period_ends_at && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> Grace period ends {new Date(subscription.grace_period_ends_at).toLocaleDateString()} -- choose a plan to keep full access.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={() => setPlanPicker("upgrade")}>
              <ArrowUpRight className="h-4 w-4" /> Upgrade
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPlanPicker("downgrade")}>Downgrade</Button>
            {isLapsed ? (
              <Button size="sm" variant="outline" onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
                <RotateCcw className="h-4 w-4" /> Reactivate
              </Button>
            ) : subscription.cancel_at_period_end ? (
              <Button size="sm" variant="outline" onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>Keep subscription</Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => cancel.mutate(true)} disabled={cancel.isPending}>
                <XCircle className="h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
          {(changePlan.isError || cancel.isError || reactivate.isError) && (
            <ErrorState error={(changePlan.error ?? cancel.error ?? reactivate.error) as ApiError} />
          )}
        </CardContent>
      </Card>

      {planPicker && (
        <Card>
          <CardHeader><CardTitle className="text-base">{planPicker === "upgrade" ? "Upgrade" : "Downgrade"} plan</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!plans && <Skeleton className="h-24" />}
            {plans?.filter((p) => (planPicker === "upgrade" ? p.tier_order > subscription.plan.tier_order : p.tier_order < subscription.plan.tier_order) && p.is_public)
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.monthly_price === null ? "Custom" : `₹${Number(subscription.billing_cycle === "yearly" ? p.yearly_price : p.monthly_price).toLocaleString("en-IN")} / ${subscription.billing_cycle === "yearly" ? "yr" : "mo"}`}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => changePlan.mutate({ action: planPicker, planSlug: p.slug })} disabled={changePlan.isPending}>
                    Select
                  </Button>
                </div>
              ))}
            {changePlan.isError && (changePlan.error as ApiError)?.code === "PLAN_DOWNGRADE_BLOCKED" && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                You&apos;re over this plan&apos;s limits:{" "}
                {((changePlan.error as ApiError).details.violations as { limit_key: string; current: number; new_limit: number }[])
                  .map((v) => `${v.limit_key.replace(/_/g, " ")} (${v.current}/${v.new_limit})`)
                  .join(", ")}
                . Reduce usage first.
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => setPlanPicker(null)}>Close</Button>
          </CardContent>
        </Card>
      )}

      {pendingInvoice && !checkout && (
        <Card className="border-primary/40">
          <CardHeader><CardTitle className="text-base">Payment required</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">Invoice {pendingInvoice.invoice_number}: <strong>₹{Number(pendingInvoice.total).toLocaleString("en-IN")}</strong></p>
            <Button size="sm" onClick={() => startCheckout.mutate(pendingInvoice.id)} disabled={startCheckout.isPending}>
              {startCheckout.isPending ? "Starting..." : "Pay now"}
            </Button>
          </CardContent>
        </Card>
      )}

      {checkout && (
        <Card className="border-primary/40">
          <CardHeader><CardTitle className="text-base">Complete payment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Order {checkout.order_id} -- ₹{(checkout.amount / 100).toLocaleString("en-IN")}
              {checkout.is_sandbox && " (sandbox: no real gateway configured, simulate the result below)"}
            </p>
            {checkout.is_sandbox ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => simulate.mutate(true)} disabled={simulate.isPending}>Simulate success</Button>
                <Button size="sm" variant="outline" onClick={() => simulate.mutate(false)} disabled={simulate.isPending}>Simulate failure</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Redirecting to the payment gateway is not wired up in this preview.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Usage this period</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!usage && <Skeleton className="h-40" />}
          {usage?.map((row) => {
            const used = Number(row.used);
            const ratio = row.limit ? used / row.limit : 0;
            return (
              <div key={row.limit_key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize">{row.limit_key.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">
                    {used.toLocaleString()} / {row.limit === null ? "Unlimited" : row.limit.toLocaleString()}
                    {!row.enforced && row.limit !== null && <span className="ml-1.5 text-xs">(not yet enforced)</span>}
                  </span>
                </div>
                {row.limit !== null && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-all", usageBarColor(ratio))} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
