import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Download,
  LogIn,
  LogOut,
  RefreshCw,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
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
import { apiFetch, ApiError } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { employeeName, type Employee } from "@/lib/people";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  status: string;
  worked_minutes: number;
  late_minutes: number;
}

interface Correction {
  id: string;
  employee_id: string;
  attendance_date: string;
  reason: string;
  status: string;
}

function formatTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AttendancePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("team");
  const [search, setSearch] = useState("");

  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => apiFetch<Employee[]>("/employees"),
  });

  const empById = useMemo(
    () => new Map((employees ?? []).map((e) => [e.id, employeeName(e)])),
    [employees]
  );

  const { data: mine, error: mineError } = useQuery({
    queryKey: ["my-attendance-today"],
    queryFn: () => apiFetch<AttendanceRecord[]>(`/attendance/me?from_date=${todayIso}`),
    retry: false,
  });

  const {
    data: today,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: () => apiFetch<AttendanceRecord[]>("/attendance/today"),
  });

  const { data: corrections } = useQuery({
    queryKey: ["attendance-corrections", "pending"],
    queryFn: () => apiFetch<Correction[]>("/attendance/corrections?status=pending"),
  });

  const clockIn = useMutation({
    mutationFn: () => apiFetch("/attendance/clock-in", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      toast.success("Clocked in successfully!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to clock in");
    },
  });

  const clockOut = useMutation({
    mutationFn: () => apiFetch("/attendance/clock-out", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      toast.success("Clocked out successfully!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to clock out");
    },
  });

  const reviewCorrection = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      apiFetch(`/attendance/corrections/${id}/review`, {
        method: "POST",
        body: { approve },
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["attendance-corrections"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      toast.success(
        variables.approve ? "Attendance correction approved" : "Attendance correction rejected"
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to process correction");
    },
  });

  const myToday = mine?.[0];
  const noEmployeeLinked = mineError instanceof ApiError && mineError.status === 404;

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    const totalPunches = today?.length ?? 0;
    const presentCount = today?.filter((r) => r.status === "present").length ?? 0;
    const exceptionsCount =
      today?.filter(
        (r) => r.status === "late" || r.status === "missing_punch" || r.status === "absent"
      ).length ?? 0;
    const pendingCorr = corrections?.length ?? 0;

    return [
      {
        id: "total",
        label: "Punches Recorded Today",
        value: totalPunches,
        sublabel: "Floor & office entries",
        icon: UserCheck,
        color: "primary",
        onClick: () => setActiveTab("team"),
      },
      {
        id: "present",
        label: "On-Time & Present",
        value: presentCount,
        sublabel: "Active on duty",
        icon: CheckCircle2,
        color: "emerald",
        onClick: () => setActiveTab("team"),
      },
      {
        id: "exceptions",
        label: "Exceptions & Late Punches",
        value: exceptionsCount,
        sublabel: "Missing punches or delays",
        icon: Clock,
        color: exceptionsCount > 0 ? "amber" : "neutral",
        onClick: () => setActiveTab("team"),
      },
      {
        id: "corrections",
        label: "Correction Requests",
        value: pendingCorr,
        sublabel: "Awaiting approval",
        icon: AlertTriangle,
        color: pendingCorr > 0 ? "blue" : "neutral",
        onClick: () => setActiveTab("corrections"),
      },
    ];
  }, [today, corrections]);

  // Attention Items
  const attentionItems: AttentionItem[] = useMemo(() => {
    const list: AttentionItem[] = [];

    if (corrections && corrections.length > 0) {
      list.push({
        id: "pending-corrections",
        title: `${corrections.length} punch correction request${corrections.length > 1 ? "s" : ""} pending approval`,
        description: "Employees have submitted correction requests with explanations for missed punches.",
        severity: "warning",
        count: corrections.length,
        actionLabel: "Review Requests",
        onAction: () => setActiveTab("corrections"),
      });
    }

    const missingPunches = today?.filter((r) => r.status === "missing_punch") ?? [];
    if (missingPunches.length > 0) {
      list.push({
        id: "missing-punches",
        title: `${missingPunches.length} staff member${missingPunches.length > 1 ? "s" : ""} have missing punch records`,
        description: "Staff clocked in but have no exit or out punch recorded.",
        severity: "info",
        count: missingPunches.length,
        actionLabel: "View Today's Roster",
        onAction: () => setActiveTab("team"),
      });
    }

    return list;
  }, [corrections, today]);

  // Filtered team attendance
  const filteredTeam = useMemo(() => {
    if (!today) return [];
    return today.filter((r) => {
      if (search.trim()) {
        const query = search.toLowerCase();
        const emp = (empById.get(r.employee_id) ?? "").toLowerCase();
        const status = r.status.toLowerCase();
        if (!emp.includes(query) && !status.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [today, search, empById]);

  // Tabs
  const tabs = useMemo(() => {
    return [
      { id: "team", label: "Today's Team Attendance", count: today?.length ?? 0 },
      { id: "corrections", label: "Pending Corrections", count: corrections?.length ?? 0 },
    ];
  }, [today, corrections]);

  const exportTodayCsv = () => {
    if (!today) return;
    const headers = [
      "Staff Member",
      "Date",
      "Clock In",
      "Clock Out",
      "Status",
      "Worked Minutes",
      "Late Minutes",
    ];
    const rows = today.map((r) => [
      empById.get(r.employee_id) ?? r.employee_id,
      r.attendance_date,
      formatTime(r.clock_in_at),
      formatTime(r.clock_out_at),
      r.status,
      r.worked_minutes,
      r.late_minutes,
    ]);
    downloadCsv(`attendance-${todayIso}.csv`, [headers, ...rows]);
    toast.success(`Exported ${today.length} attendance records`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Workforce Attendance & Time Tracking"
        description="Monitor real-time shifts, self check-ins, floor muster status, and employee punch correction requests."
        secondaryActions={[
          {
            label: "Export Roster",
            icon: Download,
            onClick: exportTodayCsv,
          },
          {
            label: isFetching ? "Refreshing..." : "Refresh",
            icon: RefreshCw,
            onClick: () => refetch(),
          },
        ]}
      />

      {/* 2. Self Clock-in Action Card */}
      {!noEmployeeLinked && (
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">My Attendance Today</h3>
                <p className="text-xs text-muted-foreground">
                  {myToday?.clock_in_at ? (
                    <>
                      Clocked In: <span className="font-semibold text-foreground">{formatTime(myToday.clock_in_at)}</span>
                      {myToday.clock_out_at && (
                        <> · Clocked Out: <span className="font-semibold text-foreground">{formatTime(myToday.clock_out_at)}</span></>
                      )}
                    </>
                  ) : (
                    "Not clocked in yet for today's shift."
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!myToday?.clock_in_at && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => clockIn.mutate()}
                  disabled={clockIn.isPending}
                >
                  <LogIn className="h-4 w-4" />
                  Clock In Now
                </Button>
              )}
              {myToday?.clock_in_at && !myToday?.clock_out_at && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-primary/30"
                  onClick={() => clockOut.mutate()}
                  disabled={clockOut.isPending}
                >
                  <LogOut className="h-4 w-4" />
                  Clock Out
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Metric Strip */}
      <MetricStrip metrics={metrics} />

      {/* 4. Attention Panel */}
      <AttentionPanel
        title="Time & Attendance Action Items"
        items={attentionItems}
        allClearMessage="No pending punch corrections or unresolved attendance exceptions."
      />

      {/* 5. Saved Views & Search */}
      <SavedViews
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by employee name or status..."
      />

      {/* 6. Main Tab Content */}
      {activeTab === "team" && (
        <div className="space-y-4">
          {isLoading && <Skeleton className="h-48 w-full" />}
          {error && <ErrorState error={error} onRetry={() => refetch()} />}

          {!isLoading && !error && filteredTeam.length === 0 && (
            <SmartEmptyState
              mode={search ? "filtered" : "operational"}
              title={search ? "No matching attendance punches" : "No punches recorded today"}
              description={
                search
                  ? "Try clearing your search query."
                  : "Attendance punches will appear in real time as employees clock in through mobile or biometric terminals."
              }
              actionLabel={search ? "Reset Search" : undefined}
              onAction={search ? () => setSearch("") : undefined}
            />
          )}

          {!isLoading && !error && filteredTeam.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {filteredTeam.map((r) => {
                const name = empById.get(r.employee_id) ?? "Employee";

                return (
                  <div
                    key={r.id}
                    className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                        {name[0]}
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">{name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <LogIn className="h-3.5 w-3.5 text-emerald-500" />
                            In: {formatTime(r.clock_in_at)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                            Out: {formatTime(r.clock_out_at)}
                          </span>
                          {r.worked_minutes > 0 && (
                            <>
                              <span>•</span>
                              <span>{(r.worked_minutes / 60).toFixed(1)} hrs worked</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {r.late_minutes > 0 && (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          {r.late_minutes}m late
                        </span>
                      )}
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "corrections" && (
        <div className="space-y-4">
          {(!corrections || corrections.length === 0) && (
            <SmartEmptyState
              mode="operational"
              title="All punch corrections resolved"
              description="No employee attendance correction requests are currently pending review."
            />
          )}

          {corrections && corrections.length > 0 && (
            <div className="space-y-3">
              {corrections.map((c) => {
                const name = empById.get(c.employee_id) ?? "Employee";

                return (
                  <Card key={c.id} className="border-border">
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{name}</span>
                          <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            Date: {c.attendance_date}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Reason: <span className="text-foreground">{c.reason}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                          onClick={() => reviewCorrection.mutate({ id: c.id, approve: true })}
                          disabled={reviewCorrection.isPending}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-red-600 hover:bg-red-500/10"
                          onClick={() => reviewCorrection.mutate({ id: c.id, approve: false })}
                          disabled={reviewCorrection.isPending}
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
