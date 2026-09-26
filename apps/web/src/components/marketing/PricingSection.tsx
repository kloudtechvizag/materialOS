import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PricingSection() {
  const [yearly, setYearly] = useState(true);

  const plans = [
    {
      name: "Growth",
      desc: "For single-branch businesses getting organized with unified billing, inventory, and GST compliance.",
      monthlyPrice: "₹2,499",
      yearlyPrice: "₹1,999",
      period: "/ month",
      popular: false,
      ctaText: "Start 14-Day Free Trial",
      ctaHref: "/signup",
      ctaVariant: "outline" as const,
      features: [
        "1 Branch & 1 Godown / Warehouse",
        "Up to 3 Team Users",
        "Full GST Billing & E-Way Bill Generation",
        "Standard Quotation to Cash Pipeline",
        "Thermal POS Receipts (58mm & 80mm)",
        "Daily Tally XML Export",
        "Standard Email & Chat Support",
      ],
    },
    {
      name: "Professional",
      desc: "For fast-growing multi-branch distributors, dealerships, and clinics needing full workflow automation.",
      monthlyPrice: "₹6,999",
      yearlyPrice: "₹5,499",
      period: "/ month",
      popular: true,
      ctaText: "Start 14-Day Free Trial",
      ctaHref: "/signup",
      ctaVariant: "default" as const,
      features: [
        "Up to 5 Branches & Warehouses",
        "Up to 15 Team Users",
        "1-Click Direct E-Invoicing (NIC IRN)",
        "FEFO Batch Expiry & Lot Traceability",
        "Inter-Warehouse Rebalancing & Fleet Trips",
        "Action Center & Anomaly Alert HUD",
        "Full HR, Attendance & Payroll Module",
        "Specialized Industry Pack (LIMS, Print, or Pharma)",
        "Priority 24/7 Phone & WhatsApp SLA",
      ],
    },
    {
      name: "Enterprise",
      desc: "For multi-entity corporations, school networks, manufacturing mills, and regional distribution chains.",
      monthlyPrice: "Custom",
      yearlyPrice: "Custom",
      period: "billed annually",
      popular: false,
      ctaText: "Schedule Enterprise Briefing",
      ctaHref: "/book-demo",
      ctaVariant: "outline" as const,
      features: [
        "Unlimited Branches & Warehouses",
        "Unlimited Team Users & Role RLS",
        "Custom Golden Workflow Architecture",
        "ERP / SAP / Legacy Migration Concierge",
        "Dedicated Database Instance & SLA",
        "Custom API & Webhook Integrations",
        "On-Premise / Private Cloud Deployment Option",
        "Dedicated Account Executive & CA Training",
      ],
    },
  ];

  return (
    <section id="pricing" className="relative bg-[#070B14] py-20 text-white border-t border-white/5">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
            <Sparkles className="h-3 w-3" />
            <span>Transparent, High-ROI Pricing</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Predictable plans that{" "}
            <span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">
              scale with your turnover
            </span>
          </h2>
          <p className="text-base text-zinc-400">
            No hidden implementation fees. No surprise per-invoice charges. 14 days free on every tier.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 text-xs font-medium">
              <button
                onClick={() => setYearly(false)}
                className={cn(
                  "rounded-lg px-4 py-2 transition-all",
                  !yearly ? "bg-violet-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                )}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setYearly(true)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-4 py-2 transition-all",
                  yearly ? "bg-violet-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                )}
              >
                <span>Annual Billing</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  Save 20% + 2 Mo Free
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, idx) => {
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
            return (
              <div
                key={idx}
                className={cn(
                  "relative flex flex-col justify-between rounded-3xl border p-8 transition-all duration-300",
                  plan.popular
                    ? "border-violet-500 bg-[#0E1324] shadow-[0_0_40px_-10px_rgba(124,58,237,0.4)] scale-105 z-10"
                    : "border-white/10 bg-[#0B0F19] hover:border-white/20 hover:bg-[#0D1220]"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-1 text-[11px] font-semibold text-white shadow-md">
                    Most Popular Choice
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="mt-2 text-xs text-zinc-400 min-h-[36px]">{plan.desc}</p>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white">{price}</span>
                    <span className="text-xs text-zinc-400">{plan.period}</span>
                  </div>

                  <div className="my-6 border-t border-white/10" />

                  {/* Feature Checklist */}
                  <ul className="space-y-3 text-xs text-zinc-300">
                    {plan.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8">
                  <Button
                    className={cn(
                      "w-full rounded-xl py-5 font-semibold text-xs sm:text-sm",
                      plan.popular
                        ? "bg-violet-600 text-white hover:bg-violet-500 shadow-md"
                        : "border-white/15 bg-white/5 text-white hover:bg-white/10"
                    )}
                    variant={plan.ctaVariant}
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

        {/* Security & Money-Back Notice */}
        <div className="mt-12 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>All plans include 14-day risk-free trial. Upgrade, downgrade, or cancel anytime with pro-rated billing.</span>
        </div>
      </div>
    </section>
  );
}
