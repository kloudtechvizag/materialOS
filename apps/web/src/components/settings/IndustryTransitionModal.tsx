import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Sparkles,
  ShieldCheck,
  Split,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Layers,
  ExternalLink,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiError } from "@/lib/api";
import { type IndustryProfile } from "@/lib/industryProfile";
import { cn } from "@/lib/utils";

interface IndustryTransitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProfile: IndustryProfile;
  targetProfileSlug: string;
  companyId: string;
  companyName: string;
  industries: { slug: string; name: string }[];
  activitySummary?: {
    invoices_count: number;
    orders_count: number;
    items_count: number;
    customers_count: number;
    has_transactions: boolean;
  };
  onSuccess: (newCompanyId?: string) => void;
}

export function IndustryTransitionModal({
  open,
  onOpenChange,
  currentProfile,
  targetProfileSlug,
  companyId,
  companyName,
  industries,
  activitySummary,
  onSuccess,
}: IndustryTransitionModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"fork" | "capabilities" | "direct">("fork");

  const targetOption = industries.find((i) => i.slug === targetProfileSlug);
  const targetName = targetOption?.name || targetProfileSlug;

  // Sister Company Form state
  const [sisterName, setSisterName] = useState(`${companyName} - ${targetName}`);
  const [cloneParties, setCloneParties] = useState(true);

  // Direct switch confirmation state
  const [confirmName, setConfirmName] = useState("");

  const hasTransactions = Boolean(activitySummary?.has_transactions);

  // Fork Mutation
  const forkMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{ id: string; name: string }>("/companies/fork", {
        method: "POST",
        body: {
          source_company_id: companyId,
          name: sisterName.trim(),
          industry_slug: targetProfileSlug,
          clone_parties: cloneParties,
        },
      });
    },
    onSuccess: (newCo) => {
      toast.success(`Sister Company "${newCo.name}" created with ${targetName} profile!`);
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      onOpenChange(false);
      onSuccess(newCo.id);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Failed to create sister company.");
    },
  });

  // Direct Switch Mutation
  const directSwitchMutation = useMutation({
    mutationFn: async () => {
      return apiFetch(`/companies/${companyId}/industry-profile`, {
        method: "PATCH",
        body: { industry_slug: targetProfileSlug },
      });
    },
    onSuccess: () => {
      toast.success(`Company profile updated to ${targetName}!`);
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      onOpenChange(false);
      onSuccess();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Failed to switch industry profile.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="space-y-2 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold">
                Smart Profile Transition Advisor
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Transitioning from <strong className="text-foreground">{currentProfile.name}</strong> to{" "}
                <strong className="text-foreground">{targetName}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Activity Intelligence Card */}
        <div
          className={cn(
            "rounded-xl border p-3.5 text-xs flex items-start gap-3 transition-all",
            hasTransactions
              ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
          )}
        >
          {hasTransactions ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="font-semibold text-sm">
              {hasTransactions
                ? "Active Operational Records Detected"
                : "Clean Account State -- Safe for Direct Transition"}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {hasTransactions ? (
                <>
                  This company has <strong>{activitySummary?.invoices_count ?? 0} invoices</strong>,{" "}
                  <strong>{activitySummary?.items_count ?? 0} items</strong>, and{" "}
                  <strong>{activitySummary?.customers_count ?? 0} customer accounts</strong>. Replacing this
                  profile directly alters your modules and workflow schemas.
                </>
              ) : (
                "No posted invoices or transaction history. You can safely switch this profile directly or create a sister entity."
              )}
            </p>
          </div>
        </div>

        {/* Intent Tabs Navigation */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-muted/50 rounded-xl border border-border/60 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("fork")}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all",
              activeTab === "fork"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Split className="h-3.5 w-3.5 text-violet-500" />
            <span>1-Click Sister Company</span>
            {hasTransactions && (
              <span className="hidden sm:inline text-[9px] bg-violet-500/15 text-violet-600 dark:text-violet-400 px-1 rounded">
                Recommended
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("capabilities")}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all",
              activeTab === "capabilities"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="h-3.5 w-3.5 text-sky-500" />
            <span>Add Capabilities</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all",
              activeTab === "direct"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowRight className="h-3.5 w-3.5 text-amber-500" />
            <span>Direct Rebrand</span>
          </button>
        </div>

        {/* Tab 1: Sister Company Fork (Recommended) */}
        {activeTab === "fork" && (
          <div className="space-y-4 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <h4 className="font-semibold text-sm text-foreground">
                  Spin Off a Sister Company for {targetName}
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Keeps <strong>{companyName}</strong>&apos;s GST invoices, tax ledgers, and audit trail 100% intact.
                Creates a new legal company under the same workspace with the <strong>{targetName}</strong> profile,
                accessible instantly from your company switcher.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="sister-co-name" className="text-xs font-medium">
                  Sister Company Name
                </Label>
                <Input
                  id="sister-co-name"
                  value={sisterName}
                  onChange={(e) => setSisterName(e.target.value)}
                  placeholder="e.g. Sri Balaji Retail Counters"
                  className="text-xs"
                />
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-background p-2.5 border border-border/60">
                <input
                  type="checkbox"
                  id="clone-parties-checkbox"
                  checked={cloneParties}
                  onChange={(e) => setCloneParties(e.target.checked)}
                  className="rounded border-border h-4 w-4 text-violet-600 focus:ring-violet-500"
                />
                <Label htmlFor="clone-parties-checkbox" className="text-xs cursor-pointer">
                  Copy customer & supplier directory (starts with fresh ₹0 opening ledger balance)
                </Label>
              </div>
            </div>

            <Button
              type="button"
              disabled={!sisterName.trim() || forkMutation.isPending}
              onClick={() => forkMutation.mutate()}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs py-2.5"
            >
              {forkMutation.isPending ? "Creating Sister Company..." : `Create & Launch ${sisterName.trim()}`}
            </Button>
          </div>
        )}

        {/* Tab 2: Smart Intent Discovery (Capabilities Overlay) */}
        {activeTab === "capabilities" && (
          <div className="space-y-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 sm:p-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <h4 className="font-semibold text-sm text-foreground">
                  Just need specific features from {targetName}?
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Often, businesses don&apos;t need to overhaul their whole system—you might just need Point of Sale (POS),
                batch expiry tracking, or mobile field sales in addition to your current operations.
              </p>
            </div>

            <div className="rounded-xl bg-background p-3 border border-border/60 space-y-2 text-xs">
              <p className="font-medium text-foreground">Popular cross-industry capability overlays:</p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  <span><strong>Retail POS Counter:</strong> Fast thermal receipt billing for walk-in counter clients</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  <span><strong>Batch & Expiry (FEFO):</strong> Perishable lots and manufacturing date tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  <span><strong>Fleet & Delivery:</strong> Live dispatch boards and multi-drop transport trips</span>
                </li>
              </ul>
            </div>

            <Button
              asChild
              variant="outline"
              className="w-full text-xs font-semibold py-2.5 border-sky-500/30 hover:bg-sky-500/10"
            >
              <Link to="/settings/capabilities" onClick={() => onOpenChange(false)}>
                <span>Open Capabilities & Module Marketplace</span>
                <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        )}

        {/* Tab 3: Direct Rebrand (For Legitimate Business Pivots) */}
        {activeTab === "direct" && (
          <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h4 className="font-semibold text-sm text-foreground">
                  Direct Entity Rebrand (Full Pivot)
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Applies the <strong>{targetName}</strong> profile directly to <strong>{companyName}</strong>.
                All existing posted invoices and accounting ledgers will remain safely stored for tax audits, but your
                navigation and item fields will adjust immediately.
              </p>
            </div>

            {hasTransactions && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="confirm-company-name" className="text-xs font-medium text-foreground">
                  Type <strong>{companyName}</strong> to authorize direct profile modification:
                </Label>
                <Input
                  id="confirm-company-name"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={`Type "${companyName}"`}
                  className="text-xs"
                />
              </div>
            )}

            <Button
              type="button"
              disabled={
                directSwitchMutation.isPending ||
                (hasTransactions && confirmName.trim() !== companyName.trim())
              }
              onClick={() => directSwitchMutation.mutate()}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs py-2.5"
            >
              {directSwitchMutation.isPending ? "Switching..." : `Confirm Switch to ${targetName}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
