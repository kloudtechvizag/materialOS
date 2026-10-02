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
import { PRICING_PLANS, FALLBACK_PLANS_OUT } from "@/marketing/content/pricingPlans";

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
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-5 sm:p-8">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const isCurrent = activePlanSlug === plan.slug;
                const isSelected = selectedPlanSlug === plan.slug;
                const isPopular = plan.slug === "growth";
                const planHighlight = PRICING_PLANS.find((p) => p.slug === plan.slug);

                const isEnterprise = plan.slug === "enterprise";
                const isFree = plan.slug === "free";

                let displayPrice = "Free";
                let pricePeriod = "";
                let billingSubtext = "";

                if (isEnterprise) {
                  displayPrice = "Custom";
                  pricePeriod = "";
                  billingSubtext = "Custom architecture & SLA";
                } else if (isFree) {
                  displayPrice = "Free";
                  pricePeriod = "";
                  billingSubtext = "Free forever";
                } else if (billingCycle === "yearly") {
                  const annualTotal = Number(plan.yearly_price ?? planHighlight?.yearlyPrice ?? 0);
                  const monthlyEffective = Math.round(annualTotal / 12);
                  displayPrice = `₹${monthlyEffective.toLocaleString("en-IN")}`;
                  pricePeriod = "/ mo";
                  billingSubtext = `₹${annualTotal.toLocaleString("en-IN")} billed annually`;
                } else {
                  const monthlyRate = Number(plan.monthly_price ?? planHighlight?.monthlyPrice ?? 0);
                  displayPrice = `₹${Math.round(monthlyRate).toLocaleString("en-IN")}`;
                  pricePeriod = "/ mo";
                  billingSubtext = "billed monthly";
                }

                // Curated feature bullets from marketing catalog (or fallback)
                const featureBullets = planHighlight?.features || plan.features;

                return (
                  <Card
                    key={plan.slug}
                    onClick={() => !isCurrent && !isEnterprise && setSelectedPlanSlug(plan.slug)}
                    className={cn(
                      "relative flex flex-col justify-between rounded-2xl border transition-all p-5",
                      isSelected && !isCurrent
                        ? "border-violet-500 bg-violet-500/5 shadow-md ring-1 ring-violet-500 cursor-pointer"
                        : "border-border/70 hover:border-border bg-card/70",
                      isCurrent && "border-emerald-500/40 bg-emerald-500/5 cursor-default",
                      isPopular && !isSelected && "border-violet-500/40 shadow-sm"
                    )}
                  >
                    {isPopular && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider shadow">
                        Most Popular
                      </span>
                    )}

                    <div className="space-y-4">
                      {/* Card Header & Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-base text-foreground">{plan.name}</h4>
                            {isCurrent && (
                              <span className="rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed min-h-[36px]">
                            {planHighlight?.description || plan.description}
                          </p>
                        </div>
                        {planHighlight?.badge && !isPopular && (
                          <span className="shrink-0 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                            {planHighlight.badge}
                          </span>
                        )}
                      </div>

                      {/* Pricing Section */}
                      <div className="pb-3 border-b border-border/50">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                            {displayPrice}
                          </span>
                          {pricePeriod && (
                            <span className="text-xs text-muted-foreground font-medium">{pricePeriod}</span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">{billingSubtext}</span>
                          {plan.trial_days > 0 ? (
                            <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold">
                              {plan.trial_days}d trial
                            </span>
                          ) : isFree ? (
                            <span className="rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-1.5 py-0.2 text-[9px] font-bold">
                              Free forever
                            </span>
                          ) : (
                            <span className="rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-1.5 py-0.2 text-[9px] font-bold">
                              Custom
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Operational Limits Box */}
                      {(() => {
                        const usersLimit = plan.limits?.users ?? planHighlight?.limits?.users ?? null;
                        const branchesLimit = plan.limits?.branches ?? planHighlight?.limits?.branches ?? null;
                        const warehousesLimit = plan.limits?.warehouses ?? planHighlight?.limits?.warehouses ?? null;
                        const invoicesLimit = plan.limits?.invoices_per_month ?? planHighlight?.limits?.invoicesPerMonth ?? null;
                        return (
                          <div className="space-y-1.5 rounded-xl bg-muted/40 p-2.5 text-[11px] border border-border/50 text-muted-foreground">
                            <div className="flex items-center justify-between">
                              <span>Users:</span>
                              <span className="font-semibold text-foreground">
                                {usersLimit === null ? "Unlimited" : `${usersLimit} users`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Branches:</span>
                              <span className="font-semibold text-foreground">
                                {branchesLimit === null ? "Unlimited" : `${branchesLimit} Branch`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Godowns:</span>
                              <span className="font-semibold text-foreground">
                                {warehousesLimit === null ? "Unlimited" : `${warehousesLimit} Godowns`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Invoices:</span>
                              <span className="font-semibold text-foreground">
                                {invoicesLimit === null
                                  ? "Unlimited"
                                  : `${Number(invoicesLimit).toLocaleString("en-IN")} / mo`}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Capabilities Highlights */}
                      <div className="space-y-2 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                          Capabilities Included:
                        </span>
                        <ul className="space-y-1.5 text-xs">
                          {featureBullets.slice(0, 4).map((f, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-foreground/80">
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span className="text-[11px] leading-snug line-clamp-1">{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-4 mt-4 border-t border-border/40">
                      {isEnterprise ? (
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenChange(false);
                            window.open("/book-demo", "_blank");
                          }}
                          className="w-full rounded-xl text-xs font-semibold py-2.5 border-border hover:bg-accent"
                          variant="outline"
                        >
                          Talk to Sales
                        </Button>
                      ) : isCurrent ? (
                        <Button
                          type="button"
                          disabled
                          className="w-full rounded-xl text-xs font-semibold py-2.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-default"
                          variant="outline"
                        >
                          Current Plan
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          disabled={upgradeMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            upgradeMutation.mutate(plan.slug);
                          }}
                          className={cn(
                            "w-full rounded-xl text-xs font-semibold py-2.5 transition-all",
                            isPopular
                              ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:from-violet-500 hover:to-indigo-500"
                              : "border-border hover:bg-accent"
                          )}
                          variant={isPopular ? "default" : "outline"}
                        >
                          {upgradeMutation.isPending ? "Upgrading..." : `Upgrade to ${plan.name}`}
                        </Button>
                      )}
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
