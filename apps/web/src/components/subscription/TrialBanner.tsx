import { useState } from "react";
import { useSubscription } from "@/lib/subscription";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
import { cn } from "@/lib/utils";

function daysUntil(iso: string | null): number {
  if (!iso) return 14;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function TrialBanner() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: subscription } = useSubscription();

  if (!subscription) return null;

  const isTrial = subscription.status === "trialing";
  const isGraceOrExpired = ["grace_period", "past_due", "expired"].includes(subscription.status);

  if (!isTrial && !isGraceOrExpired) return null;

  const daysLeft = daysUntil(subscription.trial_ends_at);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        aria-label="Manage Subscription"
        className={cn(
          "group hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all shadow-xs active:scale-95 no-drag",
          isTrial
            ? "border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/50"
            : "border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50"
        )}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              isTrial ? "bg-violet-400" : "bg-amber-400"
            )}
          />
          <span
            className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              isTrial ? "bg-violet-500" : "bg-amber-500"
            )}
          />
        </span>

        {isTrial ? (
          <>
            <span className="font-semibold">
              {daysLeft > 0 ? `${daysLeft}d trial left` : "Trial ending today"}
            </span>
            <span className="text-muted-foreground/60">•</span>
            <span className="underline decoration-violet-400/40 underline-offset-2 group-hover:decoration-violet-400">
              Upgrade
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold">Trial ended</span>
            <span className="text-muted-foreground/60">•</span>
            <span className="underline decoration-amber-400/40 underline-offset-2 group-hover:decoration-amber-400">
              Activate plan
            </span>
          </>
        )}
      </button>

      <UpgradeModal open={modalOpen} onOpenChange={setModalOpen} defaultPlan="growth" />
    </>
  );
}
