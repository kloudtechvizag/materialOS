import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  IndianRupee,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionableHeader,
  AttentionPanel,
  DetailDrawer,
  MetricStrip,
  RowActions,
  SavedViews,
  SmartEmptyState,
  StatusBadge,
  type AttentionItem,
  type MetricItem,
} from "@/components/workspace";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { employeeName, type Employee } from "@/lib/people";

interface PayrollRun {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  status: string;
  total_gross: string;
  total_net: string;
}

interface Advance {
  id: string;
  employee_id: string;
  amount: string;
  reason: string | null;
  status: string;
}

export function PayrollPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);

  const [form, setForm] = useState({
    period_label: "",
    period_start: "",
    period_end: "",
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => apiFetch<Employee[]>("/employees"),
  });

  const empById = useMemo(
    () => new Map((employees ?? []).map((e) => [e.id, employeeName(e)])),
    [employees]
  );

  const {
    data: runs,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["payroll-runs"],
    queryFn: () => apiFetch<PayrollRun[]>("/payroll/runs"),
  });

  const { data: advances } = useQuery({
    queryKey: ["advances", "pending"],
    queryFn: () => apiFetch<Advance[]>("/advances?status=pending"),
    retry: false,
  });

  const createRun = useMutation({
    mutationFn: () => apiFetch<PayrollRun>("/payroll/runs", { method: "POST", body: form }),
    onSuccess: (newRun) => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast.success("Payroll run created successfully");
      setShowForm(false);
      setForm({ period_label: "", period_start: "", period_end: "" });
      navigate(`/people/payroll/${newRun.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create payroll run");
    },
  });

  const approveAdvance = useMutation({
    mutationFn: (id: string) => apiFetch(`/advances/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      toast.success("Salary advance request approved");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to approve advance");
    },
  });

  const payAdvance = useMutation({
    mutationFn: (id: string) => apiFetch(`/advances/${id}/pay`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      toast.success("Salary advance marked as paid");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to mark advance as paid");
    },
  });

  // Calculate Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!runs) return [];
    const totalRuns = runs.length;
    const inProcessing = runs.filter(
      (r) =>
        r.status === "draft" ||
        r.status === "calculated" ||
        r.status === "pending_approval"
    ).length;
    const paidRuns = runs.filter((r) => r.status === "paid" || r.status === "locked").length;

    let totalDisbursed = 0;
    runs
      .filter((r) => r.status === "paid" || r.status === "locked")
      .forEach((r) => {
        totalDisbursed += Number(r.total_net || 0);
      });

    return [
      {
        id: "total",
        label: "Total Payroll Cycles",
        value: totalRuns,
        sublabel: "Historical run count",
        icon: Wallet,
        color: "primary",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "processing",
        label: "Cycles In-Flight",
        value: inProcessing,
        sublabel: "Pending calculation or signoff",
        icon: Clock,
        color: inProcessing > 0 ? "amber" : "neutral",
        onClick: () => setActiveTab("in_progress"),
      },
      {
        id: "advances",
        label: "Pending Advances",
        value: advances?.length ?? 0,
        sublabel: "Awaiting approval / disbursal",
        icon: IndianRupee,
        color: advances && advances.length > 0 ? "blue" : "neutral",
        onClick: () => setActiveTab("advances"),
      },
      {
        id: "disbursed",
        label: "Total Net Disbursed",
        value: `₹${(totalDisbursed / 100000).toFixed(2)}L`,
        sublabel: `${paidRuns} finalized runs`,
        icon: CheckCircle2,
        color: "emerald",
        onClick: () => setActiveTab("finalized"),
      },
    ];
  }, [runs, advances]);

  // Attention Items
  const attentionItems: AttentionItem[] = useMemo(() => {
    const list: AttentionItem[] = [];

    if (advances && advances.length > 0) {
      let totalAdvanceAmount = 0;
      advances.forEach((a) => {
        totalAdvanceAmount += Number(a.amount || 0);
      });

      list.push({
        id: "pending-advances",
        title: `${advances.length} salary advance request${advances.length > 1 ? "s" : ""} totaling ₹${totalAdvanceAmount.toLocaleString("en-IN")}`,
        description: "Review employee reasons and approve for disbursal before payroll cycle cutoff.",
        severity: "warning",
        count: advances.length,
        actionLabel: "Review Advances",
        onAction: () => setActiveTab("advances"),
      });
    }

    const unapprovedRuns = runs?.filter(
      (r) => r.status === "pending_approval" || r.status === "calculated"
    ) ?? [];
    if (unapprovedRuns.length > 0) {
      list.push({
        id: "unapproved-runs",
        title: `${unapprovedRuns.length} payroll run${unapprovedRuns.length > 1 ? "s" : ""} awaiting managerial approval / lock`,
        description: "Review net payout sheets and lock before dispatching bank transfer files.",
        severity: "info",
        count: unapprovedRuns.length,
        actionLabel: "View Pending Runs",
        onAction: () => setActiveTab("in_progress"),
      });
    }

    return list;
  }, [advances, runs]);

  // Filtered runs
  const filteredRuns = useMemo(() => {
    if (!runs) return [];
    return runs.filter((r) => {
      if (
        activeTab === "in_progress" &&
        r.status !== "draft" &&
        r.status !== "calculated" &&
        r.status !== "pending_approval"
      ) {
        return false;
      }
      if (activeTab === "finalized" && r.status !== "locked" && r.status !== "paid") {
        return false;
      }

      if (search.trim()) {
        const query = search.toLowerCase();
        const label = (r.period_label || "").toLowerCase();
        const status = r.status.toLowerCase();
        if (!label.includes(query) && !status.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [runs, activeTab, search]);

  // Tabs
  const tabs = useMemo(() => {
    if (!runs) return [];
    const inProcessing = runs.filter(
      (r) =>
        r.status === "draft" ||
        r.status === "calculated" ||
        r.status === "pending_approval"
    ).length;
    const finalized = runs.filter((r) => r.status === "locked" || r.status === "paid").length;

    return [
      { id: "all", label: "All Payroll Runs", count: runs.length },
      { id: "in_progress", label: "In Processing", count: inProcessing },
      { id: "finalized", label: "Finalized & Paid", count: finalized },
      { id: "advances", label: "Salary Advances", count: advances?.length ?? 0 },
    ];
  }, [runs, advances]);

  const exportCsv = () => {
    if (!runs) return;
    const headers = ["Period Label", "Period Start", "Period End", "Status", "Gross", "Net Pay"];
    const rows = runs.map((r) => [
      r.period_label,
      r.period_start,
      r.period_end,
      r.status,
      r.total_gross,
      r.total_net,
    ]);
    downloadCsv("payroll-runs.csv", [headers, ...rows]);
    toast.success(`Exported ${runs.length} payroll run records`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Payroll Processing & Disbursals"
        description="Execute period wage runs, inspect calculated earnings & deductions, approve advances, and lock salary disbursals."
        primaryAction={{
          label: showForm ? "Close Form" : "New Payroll Run",
          icon: showForm ? undefined : Plus,
          onClick: () => setShowForm((v) => !v),
        }}
        secondaryActions={[
          {
            label: "Export Runs",
            icon: Download,
            onClick: exportCsv,
          },
          {
            label: isFetching ? "Refreshing..." : "Refresh",
            icon: RefreshCw,
            onClick: () => refetch(),
          },
        ]}
      />

      {/* 2. Metric Strip */}
      <MetricStrip metrics={metrics} />

      {/* 3. Attention Panel */}
      <AttentionPanel
        title="Payroll Action Items & Advance Approvals"
        items={attentionItems}
        allClearMessage="All salary advances are disbursed and past payroll cycles are locked."
      />

      {/* 4. New Payroll Run Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Initiate New Payroll Cycle</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Period Label *</Label>
                <Input
                  placeholder="e.g. September 2026"
                  value={form.period_label}
                  onChange={(e) => setForm((f) => ({ ...f, period_label: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Period Start Date *</Label>
                <Input
                  type="date"
                  value={form.period_start}
                  onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Period End Date *</Label>
                <Input
                  type="date"
                  value={form.period_end}
                  onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
                />
              </div>
            </div>

            {createRun.isError && <ErrorState error={createRun.error} />}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createRun.mutate()}
                disabled={
                  !form.period_label ||
                  !form.period_start ||
                  !form.period_end ||
                  createRun.isPending
                }
              >
                {createRun.isPending ? "Creating Run..." : "Create Payroll Run"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Saved Views & Search */}
      <SavedViews
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter payroll periods or status..."
      />

      {/* 6. Tabs Main Workspace */}
      {activeTab !== "advances" && (
        <div className="space-y-4">
          {isLoading && <Skeleton className="h-48 w-full" />}
          {error && <ErrorState error={error} onRetry={() => refetch()} />}

          {!isLoading && !error && filteredRuns.length === 0 && (
            <SmartEmptyState
              mode={search || activeTab !== "all" ? "filtered" : "first-time"}
              title={
                search || activeTab !== "all"
                  ? "No matching payroll runs"
                  : "No payroll cycles created yet"
              }
              description={
                search || activeTab !== "all"
                  ? "Try resetting your search query or tab selection."
                  : "Create a payroll run for the current month or pay period to calculate salaries."
              }
              actionLabel={search || activeTab !== "all" ? "Reset Filters" : "Create First Run"}
              onAction={() => {
                if (search || activeTab !== "all") {
                  setSearch("");
                  setActiveTab("all");
                } else {
                  setShowForm(true);
                }
              }}
            />
          )}

          {!isLoading && !error && filteredRuns.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {filteredRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{run.period_label}</span>
                      <StatusBadge status={run.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Period: {run.period_start} to {run.period_end}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-base font-bold text-foreground">
                        ₹{Number(run.total_net || 0).toLocaleString("en-IN")}
                      </span>
                      <p className="text-xs text-muted-foreground">Net Pay</p>
                    </div>

                    <Button
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => navigate(`/people/payroll/${run.id}`)}
                    >
                      <span>Pipeline</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>

                    <RowActions
                      onQuickPeek={() => setSelectedRun(run)}
                      actions={[
                        {
                          label: "Open Full Payroll Worksheet",
                          icon: CreditCard,
                          onClick: () => navigate(`/people/payroll/${run.id}`),
                        },
                        {
                          label: "Quick Snapshot",
                          icon: Eye,
                          onClick: () => setSelectedRun(run),
                        },
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Advances Workspace Tab */}
      {activeTab === "advances" && (
        <div className="space-y-4">
          {(!advances || advances.length === 0) && (
            <SmartEmptyState
              mode="operational"
              title="All advance requests processed"
              description="No employee salary advance requests are currently pending approval or payment."
            />
          )}

          {advances && advances.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {advances.map((a) => {
                const name = empById.get(a.employee_id) ?? "Employee";

                return (
                  <div
                    key={a.id}
                    className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{name}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="text-sm font-semibold text-primary">
                        ₹{Number(a.amount).toLocaleString("en-IN")}
                      </p>
                      {a.reason && (
                        <p className="text-xs text-muted-foreground italic">&ldquo;{a.reason}&rdquo;</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                        onClick={() => approveAdvance.mutate(a.id)}
                        disabled={approveAdvance.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => payAdvance.mutate(a.id)}
                        disabled={payAdvance.isPending}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Mark Paid
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 7. Payroll Run Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedRun}
        onClose={() => setSelectedRun(null)}
        title={selectedRun?.period_label ?? "Payroll Run"}
        subtitle="Period Payroll Cycle Snapshot"
        badge={selectedRun?.status ? <StatusBadge status={selectedRun.status} /> : undefined}
        metrics={[
          {
            label: "Gross Salary",
            value: selectedRun
              ? `₹${Number(selectedRun.total_gross || 0).toLocaleString("en-IN")}`
              : "—",
          },
          {
            label: "Net Payout",
            value: selectedRun
              ? `₹${Number(selectedRun.total_net || 0).toLocaleString("en-IN")}`
              : "—",
          },
          {
            label: "Period Start",
            value: selectedRun?.period_start ?? "—",
          },
          {
            label: "Period End",
            value: selectedRun?.period_end ?? "—",
          },
        ]}
        actions={
          selectedRun ? (
            <Button
              className="gap-1.5"
              onClick={() => {
                navigate(`/people/payroll/${selectedRun.id}`);
              }}
            >
              <CreditCard className="h-4 w-4" />
              Open Payroll Pipeline
            </Button>
          ) : undefined
        }
      >
        <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
          Click &ldquo;Open Payroll Pipeline&rdquo; to calculate hours, verify deductions, apply
          advances, and trigger direct bank transfer payout files for this cycle.
        </div>
      </DetailDrawer>
    </div>
  );
}
