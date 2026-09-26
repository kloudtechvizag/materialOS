import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Building2,
  Package,
  Receipt,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingTourCardProps {
  tenantLogoUrl?: string | null;
  className?: string;
}

interface StepItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isCompleted: boolean;
}

const STORAGE_KEY_DISMISSED = "materialos_onboarding_dismissed";
const STORAGE_KEY_MINIMIZED = "materialos_onboarding_minimized";
const STORAGE_KEY_STEPS = "materialos_onboarding_steps_state";

export function OnboardingTourCard({ tenantLogoUrl, className }: OnboardingTourCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [manualSteps, setManualSteps] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED) === "true";
      const minimized = localStorage.getItem(STORAGE_KEY_MINIMIZED) === "true";
      const savedSteps = localStorage.getItem(STORAGE_KEY_STEPS);
      setIsDismissed(dismissed);
      setIsMinimized(minimized);
      if (savedSteps) {
        setManualSteps(JSON.parse(savedSteps));
      }
    } catch {
      // Ignore local storage errors in privacy mode
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY_DISMISSED, "true");
    } catch {
      // local storage
    }
  };

  const handleToggleMinimize = () => {
    const next = !isMinimized;
    setIsMinimized(next);
    try {
      localStorage.setItem(STORAGE_KEY_MINIMIZED, String(next));
    } catch {
      // local storage
    }
  };

  const toggleStep = (stepId: string) => {
    setManualSteps((prev) => {
      const updated = { ...prev, [stepId]: !prev[stepId] };
      try {
        localStorage.setItem(STORAGE_KEY_STEPS, JSON.stringify(updated));
      } catch {
        // local storage
      }
      return updated;
    });
  };

  const steps: StepItem[] = [
    {
      id: "brand",
      title: "Set Tenant Brand & Logo",
      description: "Upload your corporate logo for receipts, headers, and invoices.",
      href: "/settings/company",
      icon: ImageIcon,
      isCompleted: Boolean(tenantLogoUrl) || Boolean(manualSteps["brand"]),
    },
    {
      id: "branch",
      title: "Verify Primary Branch & GSTIN",
      description: "Confirm your registered state code, address, and dispatch godowns.",
      href: "/branches",
      icon: Building2,
      isCompleted: Boolean(manualSteps["branch"]),
    },
    {
      id: "catalog",
      title: "Add Items, Lots & Stock Rates",
      description: "Import your product master list, HSN codes, and initial batch balances.",
      href: "/items",
      icon: Package,
      isCompleted: Boolean(manualSteps["catalog"]),
    },
    {
      id: "transaction",
      title: "Generate First Sale or 80mm Bill",
      description: "Create an e-invoiced sale order, counter receipt, or test delivery challan.",
      href: "/sales/orders",
      icon: Receipt,
      isCompleted: Boolean(manualSteps["transaction"]),
    },
  ];

  const completedCount = steps.filter((s) => s.isCompleted).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  if (isDismissed) {
    return null;
  }

  // Minimized floating trigger pill
  if (isMinimized) {
    return (
      <div className={cn("fixed bottom-5 right-5 z-40 animate-in fade-in slide-in-from-bottom-2", className)}>
        <button
          onClick={handleToggleMinimize}
          className="flex items-center gap-2.5 rounded-full border border-violet-500/30 bg-card/95 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition-all hover:border-violet-500 hover:shadow-violet-500/10"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-400">
            <Sparkles className="h-3 w-3" />
          </div>
          <span>Setup Velocity</span>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
            {completedCount}/{steps.length} ({progressPercent}%)
          </span>
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative mb-6 overflow-hidden rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 via-background to-sky-500/5 p-5 shadow-sm transition-all",
        className,
      )}
    >
      {/* Header bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Welcome to MaterialOS Workspace</h3>
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-300">
                {progressPercent}% Complete
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Complete these high-impact setup steps to unlock automated workflows and compliance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggleMinimize}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Minimize setup guide"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Dismiss setup guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step Grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={cn(
                "group relative flex flex-col justify-between rounded-lg border p-3.5 transition-all",
                step.isCompleted
                  ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                  : "border-border/60 bg-card hover:border-violet-500/40 hover:shadow-sm",
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md text-xs",
                      step.isCompleted
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground group-hover:bg-violet-500/10 group-hover:text-violet-600 dark:group-hover:text-violet-400",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleStep(step.id)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                    title={step.isCompleted ? "Mark as pending" : "Mark as completed"}
                  >
                    {step.isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/60 group-hover:text-violet-500" />
                    )}
                  </button>
                </div>
                <h4 className="mt-2.5 text-xs font-semibold text-foreground">
                  {index + 1}. {step.title}
                </h4>
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{step.description}</p>
              </div>

              <div className="mt-3 pt-2">
                <Button
                  size="sm"
                  variant={step.isCompleted ? "ghost" : "outline"}
                  className={cn(
                    "w-full justify-between h-7 text-[11px] font-medium px-2.5",
                    !step.isCompleted && "border-violet-500/30 text-violet-600 dark:text-violet-300 hover:bg-violet-500/10",
                  )}
                  asChild
                >
                  <Link to={step.href}>
                    <span>{step.isCompleted ? "Review" : "Configure"}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
