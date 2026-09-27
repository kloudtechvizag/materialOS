import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Sparkles, Zap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, ApiError } from "@/lib/api";
import { useSubscription, type PlanOut } from "@/lib/subscription";
import { cn } from "@/lib/utils";
import { FALLBACK_PLANS_OUT } from "@/marketing/content/pricingPlans";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPlan?: string;
}

interface SubscriptionChangeOut {
  subscription: any;
  invoice: { id: string; invoice_number: string; total: string } | null;
}

interface CheckoutOut {
  payment: { id: string };
  order_id: string;
  amount: number;
  currency: string;
  is_sandbox: boolean;
}

export function UpgradeModal({ open, onOpenChange, defaultPlan = "growth" }: UpgradeModalProps) {
  const queryClient = useQueryClient();
  const { data: subscription } = useSubscription();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>(defaultPlan);
  const [checkoutStep, setCheckoutStep] = useState<"select" | "checkout">("select");
  const [checkoutData, setCheckoutData] = useState<CheckoutOut | null>(null);

  const { data: plans = FALLBACK_PLANS_OUT } = useQuery({
    queryKey: ["pricing-plans-modal"],
    queryFn: () => apiFetch<PlanOut[]>("/pricing/plans", { auth: false }),
    initialData: FALLBACK_PLANS_OUT,
  });

  const upgradeMutation = useMutation({
    mutationFn: async (planSlug: string) => {
      return apiFetch<SubscriptionChangeOut>("/subscription/upgrade", {
        method: "POST",
        body: { plan_slug: planSlug, billing_cycle: billingCycle },
      });
    },
    onSuccess: async (data) => {
      if (data.invoice) {
        // Invoice generated, initiate checkout
        const checkout = await apiFetch<CheckoutOut>("/billing/checkout", {
          method: "POST",
          body: { invoice_id: data.invoice.id },
        });
        setCheckoutData(checkout);
        setCheckoutStep("checkout");
      } else {
        // Free or immediate activation
        queryClient.invalidateQueries({ queryKey: ["subscription"] });
        toast.success("Subscription updated successfully!");
        onOpenChange(false);
      }
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Failed to initiate plan upgrade.");
    },
  });

  const simulatePayment = useMutation({
    mutationFn: async () => {
      if (!checkoutData) return;
      return apiFetch(`/billing/checkout/${checkoutData.payment.id}/simulate`, {
        method: "POST",
        body: { succeed: true },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Payment verified! Your plan is now active.");
      setCheckoutStep("select");
      setCheckoutData(null);
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Payment simulation failed.");
    },
  });

  const activePlanSlug = subscription?.plan?.slug ?? "free";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="text-center space-y-2 pb-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
            {checkoutStep === "select" ? "Select the Right Edition for Your Business" : "Complete Your Subscription"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto">
            {checkoutStep === "select"
              ? "All plans include multi-location compliance, automated GST ledger, and continuous data sync."
              : "Complete checkout to activate your subscription immediately."}
          </DialogDescription>
        </DialogHeader>

        {checkoutStep === "select" ? (
          <div className="space-y-6 pt-2">
            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={cn(
                    "rounded-full px-4 py-1.5 font-medium transition-all",
                    billingCycle === "monthly" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("yearly")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition-all",
                    billingCycle === "yearly" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>Annual Billing</span>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.2 text-[10px] font-bold">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrent = activePlanSlug === plan.slug;
                const isSelected = selectedPlanSlug === plan.slug;
                const isPopular = plan.slug === "growth";
                const price = billingCycle === "yearly" ? plan.yearly_price : plan.monthly_price;
                const displayPrice = price && Number(price) > 0 ? `₹${Math.round(Number(price)).toLocaleString("en-IN")}` : "Free";

                return (
                  <Card
                    key={plan.slug}
                    onClick={() => !isCurrent && setSelectedPlanSlug(plan.slug)}
                    className={cn(
                      "relative flex flex-col justify-between rounded-2xl border transition-all cursor-pointer p-5",
                      isSelected
                        ? "border-violet-500 bg-violet-500/5 shadow-md ring-1 ring-violet-500"
                        : "border-border/60 hover:border-border bg-card/60",
                      isCurrent && "opacity-80 cursor-default"
                    )}
                  >
                    {isPopular && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-2.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider shadow">
                        Recommended
                      </span>
                    )}

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-base text-foreground">{plan.name}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{plan.description}</p>
                        </div>
                        {isCurrent && (
                          <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            Current
                          </span>
                        )}
                      </div>

                      <div className="pb-3 border-b border-border/50">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-foreground">{displayPrice}</span>
                          {price && Number(price) > 0 && (
                            <span className="text-xs text-muted-foreground">/ month</span>
                          )}
                        </div>
                      </div>

                      {/* Limits */}
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Users:</span>
                          <span className="font-medium text-foreground">{plan.limits.users ?? "Unlimited"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Branches:</span>
                          <span className="font-medium text-foreground">{plan.limits.branches ?? "Unlimited"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Invoices:</span>
                          <span className="font-medium text-foreground">
                            {plan.limits.invoices_per_month ? `${plan.limits.invoices_per_month}/mo` : "Unlimited"}
                          </span>
                        </div>
                      </div>

                      {/* Capabilities */}
                      <ul className="space-y-1.5 pt-2 text-xs">
                        {plan.features.slice(0, 4).map((f, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-foreground/80">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-5 mt-4 border-t border-border/40">
                      <Button
                        type="button"
                        disabled={isCurrent || upgradeMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isCurrent) upgradeMutation.mutate(plan.slug);
                        }}
                        className={cn(
                          "w-full rounded-xl text-xs font-semibold py-2.5",
                          isPopular
                            ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:from-violet-500 hover:to-indigo-500"
                            : "border-border hover:bg-accent"
                        )}
                        variant={isPopular ? "default" : "outline"}
                      >
                        {isCurrent ? "Current Plan" : `Upgrade to ${plan.name}`}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          /* Checkout Step */
          <div className="max-w-md mx-auto space-y-6 pt-4 text-center">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm font-medium text-muted-foreground">Order Reference:</span>
                <span className="text-xs font-mono font-semibold text-foreground">{checkoutData?.order_id}</span>
              </div>
              <div className="flex items-center justify-between text-base">
                <span className="font-semibold text-foreground">Total Due:</span>
                <span className="font-bold text-xl text-foreground">
                  ₹{checkoutData ? (checkoutData.amount / 100).toLocaleString("en-IN") : "0"}
                </span>
              </div>

              {checkoutData?.is_sandbox && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400 text-left space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" />
                    Sandbox Payment Gateway Active
                  </div>
                  <p>In dev/test mode, click below to simulate immediate cryptographic webhook activation.</p>
                </div>
              )}

              <Button
                type="button"
                disabled={simulatePayment.isPending}
                onClick={() => simulatePayment.mutate()}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                {simulatePayment.isPending ? "Confirming..." : "Simulate Successful Payment"}
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCheckoutStep("select")}
              className="text-xs text-muted-foreground"
            >
              Back to plan selection
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
