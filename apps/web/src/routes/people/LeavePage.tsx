import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
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
  MetricStrip,
  SavedViews,
  SmartEmptyState,
  StatusBadge,
  type AttentionItem,
  type MetricItem,
} from "@/components/workspace";
import { apiFetch } from "@/lib/api";
import { employeeName, type Employee } from "@/lib/people";

interface LeaveType {
  id: string;
  code: string;
  name: string;
  annual_allocation_days: string;
  is_paid: boolean;
}

interface LeaveBalance {
  leave_type_id: string;
  allocated_days: string;
  used_days: string;
  carried_forward_days: string;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: string;
  reason: string | null;
  status: string;
}

export function LeavePage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("team");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => apiFetch<Employee[]>("/employees"),
  });

  const empById = useMemo(
    () => new Map((employees ?? []).map((e) => [e.id, employeeName(e)])),
    [employees]
  );

  const { data: leaveTypes } = useQuery({
    queryKey: ["leave-types"],
    queryFn: () => apiFetch<LeaveType[]>("/leave/types"),
  });

  const { data: balances } = useQuery({
    queryKey: ["leave-balance-me"],
    queryFn: () => apiFetch<LeaveBalance[]>("/leave/balance/me"),
    retry: false,
  });

  const {
    data: myRequests,
    isLoading: myLoading,
    error: myError,
    refetch: refetchMy,
  } = useQuery({
    queryKey: ["my-leave-requests"],
    queryFn: () => apiFetch<LeaveRequest[]>("/leave/requests/me"),
    retry: false,
  });

  const {
    data: teamRequests,
    isLoading: teamLoading,
    refetch: refetchTeam,
    isFetching,
  } = useQuery({
    queryKey: ["team-leave-requests", "pending"],
    queryFn: () => apiFetch<LeaveRequest[]>("/leave/requests?status=pending"),
    retry: false,
  });

  const typeById = useMemo(
    () => new Map((leaveTypes ?? []).map((t) => [t.id, t.name])),
    [leaveTypes]
  );

  const requestLeave = useMutation({
    mutationFn: () =>
      apiFetch<LeaveRequest>("/leave/requests", { method: "POST", body: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balance-me"] });
      toast.success("Leave request submitted successfully");
      setShowForm(false);
      setForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
      setActiveTab("my");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to submit leave request");
    },
  });

  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      apiFetch(`/leave/requests/${id}/review`, { method: "POST", body: { approve } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["team-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balance-me"] });
      toast.success(variables.approve ? "Leave request approved" : "Leave request rejected");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to review leave request");
    },
  });

  // Calculate Metrics
  const metrics: MetricItem[] = useMemo(() => {
    let totalAvailable = 0;
    let totalUsed = 0;
    balances?.forEach((b) => {
      totalAvailable +=
        Number(b.allocated_days || 0) +
        Number(b.carried_forward_days || 0) -
        Number(b.used_days || 0);
      totalUsed += Number(b.used_days || 0);
    });

    const pendingTeam = teamRequests?.length ?? 0;
    const myPending = myRequests?.filter((r) => r.status === "pending").length ?? 0;

    return [
      {
        id: "team-pending",
        label: "Team Requests Pending",
        value: pendingTeam,
        sublabel: "Awaiting manager approval",
        icon: Users,
        color: pendingTeam > 0 ? "amber" : "neutral",
        onClick: () => setActiveTab("team"),
      },
      {
        id: "balance",
        label: "My Available Balance",
        value: `${totalAvailable.toFixed(1)} days`,
        sublabel: "Across all leave quotas",
        icon: CheckCircle2,
        color: totalAvailable > 0 ? "emerald" : "neutral",
        onClick: () => setActiveTab("balances"),
      },
      {
        id: "used",
        label: "My Days Taken",
        value: `${totalUsed.toFixed(1)} days`,
        sublabel: "Consumed this cycle",
        icon: Calendar,
        color: "primary",
        onClick: () => setActiveTab("my"),
      },
      {
        id: "my-pending",
        label: "My Requests Pending",
        value: myPending,
        sublabel: "Awaiting signoff",
        icon: Clock,
        color: myPending > 0 ? "blue" : "neutral",
        onClick: () => setActiveTab("my"),
      },
    ];
  }, [balances, teamRequests, myRequests]);

  // Attention items
  const attentionItems: AttentionItem[] = useMemo(() => {
    const list: AttentionItem[] = [];

    if (teamRequests && teamRequests.length > 0) {
      list.push({
        id: "pending-team",
        title: `${teamRequests.length} team leave application${teamRequests.length > 1 ? "s" : ""} pending approval`,
        description: "Review dates and operational coverage before granting leave requests.",
        severity: "warning",
        count: teamRequests.length,
        actionLabel: "Review Requests",
        onAction: () => setActiveTab("team"),
      });
    }

    const pendingMine = myRequests?.filter((r) => r.status === "pending") ?? [];
    if (pendingMine.length > 0) {
      list.push({
        id: "pending-mine",
        title: `${pendingMine.length} of your leave requests are awaiting supervisor approval`,
        description: "Your supervisor has been notified of your leave application.",
        severity: "info",
        count: pendingMine.length,
        actionLabel: "View My Requests",
        onAction: () => setActiveTab("my"),
      });
    }

    return list;
  }, [teamRequests, myRequests]);

  // Tabs
  const tabs = useMemo(() => {
    return [
      { id: "team", label: "Team Approval Queue", count: teamRequests?.length ?? 0 },
      { id: "my", label: "My Leave Requests", count: myRequests?.length ?? 0 },
      { id: "balances", label: "Leave Quotas & Balances", count: balances?.length ?? 0 },
    ];
  }, [teamRequests, myRequests, balances]);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Leave Management & Time Off"
        description="Submit leave applications, track personal entitlement balances, and approve subordinate team requests."
        primaryAction={{
          label: showForm ? "Close Form" : "Request Leave",
          icon: showForm ? undefined : Plus,
          onClick: () => setShowForm((v) => !v),
        }}
        secondaryActions={[
          {
            label: isFetching ? "Refreshing..." : "Refresh",
            icon: RefreshCw,
            onClick: () => {
              refetchTeam();
              refetchMy();
            },
          },
        ]}
      />

      {/* 2. Metric Strip */}
      <MetricStrip metrics={metrics} />

      {/* 3. Attention Panel */}
      <AttentionPanel
        title="Time-Off Approvals & Alerts"
        items={attentionItems}
        allClearMessage="All team leave requests have been reviewed and approved. No backlog."
      />

      {/* 4. Request Leave Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Submit Leave Application</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Leave Type *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.leave_type_id}
                  onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))}
                >
                  <option value="">Select leave quota type...</option>
                  {leaveTypes?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.annual_allocation_days} days/yr, {t.is_paid ? "Paid" : "Unpaid"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Reason / Handover Notes</Label>
                <Input
                  placeholder="e.g. Annual family vacation. Handover completed to Sarah."
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
            </div>

            {requestLeave.isError && <ErrorState error={requestLeave.error} />}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => requestLeave.mutate()}
                disabled={
                  !form.leave_type_id ||
                  !form.start_date ||
                  !form.end_date ||
                  requestLeave.isPending
                }
              >
                {requestLeave.isPending ? "Submitting..." : "Submit Application"}
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
        searchPlaceholder="Filter requests..."
      />

      {/* 6. Tabs Content */}
      {activeTab === "team" && (
        <div className="space-y-4">
          {teamLoading && <Skeleton className="h-40 w-full" />}

          {(!teamRequests || teamRequests.length === 0) && (
            <SmartEmptyState
              mode="operational"
              title="Team approval queue is clear"
              description="No employee leave requests are awaiting supervisor approval."
            />
          )}

          {teamRequests && teamRequests.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {teamRequests.map((r) => {
                const name = empById.get(r.employee_id) ?? "Team Member";
                const typeName = typeById.get(r.leave_type_id) ?? "Leave";

                return (
                  <div
                    key={r.id}
                    className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{name}</span>
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {typeName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({r.days} {Number(r.days) === 1 ? "day" : "days"})
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Duration:{" "}
                        <span className="font-medium text-foreground">
                          {r.start_date} to {r.end_date}
                        </span>
                      </p>
                      {r.reason && (
                        <p className="text-xs text-muted-foreground italic">
                          &ldquo;{r.reason}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                        onClick={() => review.mutate({ id: r.id, approve: true })}
                        disabled={review.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-red-600 hover:bg-red-500/10"
                        onClick={() => review.mutate({ id: r.id, approve: false })}
                        disabled={review.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "my" && (
        <div className="space-y-4">
          {myLoading && <Skeleton className="h-40 w-full" />}
          {myError && <ErrorState error={myError} onRetry={() => refetchMy()} />}

          {!myLoading && !myError && (!myRequests || myRequests.length === 0) && (
            <SmartEmptyState
              mode="first-time"
              title="No leave requests filed"
              description="When you need time off, click 'Request Leave' above to submit an application."
              actionLabel="Request Leave"
              onAction={() => setShowForm(true)}
            />
          )}

          {myRequests && myRequests.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {myRequests.map((r) => {
                const typeName = typeById.get(r.leave_type_id) ?? "Leave";

                return (
                  <div
                    key={r.id}
                    className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{typeName}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {r.start_date} to {r.end_date} &bull; {r.days} days
                      </p>
                      {r.reason && (
                        <p className="text-xs text-muted-foreground">{r.reason}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "balances" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {balances?.map((b) => {
            const typeName = typeById.get(b.leave_type_id) ?? "Leave Quota";
            const total = Number(b.allocated_days) + Number(b.carried_forward_days);
            const used = Number(b.used_days);
            const remaining = Math.max(0, total - used);
            const percentageUsed = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

            return (
              <Card key={b.leave_type_id} className="border-border">
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground">{typeName}</h4>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {remaining.toFixed(1)} days left
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${percentageUsed}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{used.toFixed(1)} days consumed</span>
                    <span>{total.toFixed(1)} days total quota</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
