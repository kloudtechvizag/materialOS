import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, LogIn, LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";

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

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  present: "success", late: "secondary", half_day: "secondary", on_leave: "outline",
  absent: "destructive", missing_punch: "destructive", holiday: "outline", weekly_off: "outline",
};

function formatTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** /people/attendance -- self clock-in/out (spec sec17) plus today's
 * team view and pending correction requests (spec sec24-25) for
 * whoever holds attendance.approve. */
export function AttendancePage() {
  const queryClient = useQueryClient();

  const { data: mine, error: mineError } = useQuery({
    queryKey: ["my-attendance-today"],
    queryFn: () => apiFetch<AttendanceRecord[]>(`/attendance/me?from_date=${new Date().toISOString().slice(0, 10)}`),
    retry: false,
  });
  const { data: today, isLoading, error, refetch } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: () => apiFetch<AttendanceRecord[]>("/attendance/today"),
  });
  const { data: corrections } = useQuery({
    queryKey: ["attendance-corrections", "pending"],
    queryFn: () => apiFetch<Correction[]>("/attendance/corrections?status=pending"),
  });

  const clockIn = useMutation({
    mutationFn: () => apiFetch("/attendance/clock-in", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-attendance-today"] }),
  });
  const clockOut = useMutation({
    mutationFn: () => apiFetch("/attendance/clock-out", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-attendance-today"] }),
  });
  const reviewCorrection = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => apiFetch(`/attendance/corrections/${id}/review`, { method: "POST", body: { approve } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance-corrections"] }),
  });

  const myToday = mine?.[0];
  const noEmployeeLinked = mineError instanceof ApiError && mineError.status === 404;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Clock in, view today&apos;s team attendance, and review corrections.</p>
      </div>

      {!noEmployeeLinked && (
        <Card>
          <CardHeader><CardTitle className="text-base">My attendance today</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {myToday?.clock_in_at ? (
                <>In: {formatTime(myToday.clock_in_at)}{myToday.clock_out_at && ` · Out: ${formatTime(myToday.clock_out_at)}`}</>
              ) : (
                "Not clocked in yet."
              )}
            </div>
            {!myToday?.clock_in_at && (
              <Button size="sm" onClick={() => clockIn.mutate()} disabled={clockIn.isPending}><LogIn className="h-4 w-4" /> Clock in</Button>
            )}
            {myToday?.clock_in_at && !myToday?.clock_out_at && (
              <Button size="sm" variant="outline" onClick={() => clockOut.mutate()} disabled={clockOut.isPending}><LogOut className="h-4 w-4" /> Clock out</Button>
            )}
            {clockIn.isError && <ErrorState error={clockIn.error} />}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Today&apos;s team attendance</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-32" />}
          {error && <ErrorState error={error} onRetry={() => refetch()} />}
          {today && today.length === 0 && <p className="text-sm text-muted-foreground">No attendance recorded yet today.</p>}
          {today && today.length > 0 && (
            <div className="space-y-2">
              {today.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-muted-foreground" /> {formatTime(r.clock_in_at)} - {formatTime(r.clock_out_at)}</span>
                  <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>{r.status.replace(/_/g, " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {corrections && corrections.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pending corrections</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {corrections.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div>
                  <p>{c.attendance_date}</p>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => reviewCorrection.mutate({ id: c.id, approve: true })}>Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => reviewCorrection.mutate({ id: c.id, approve: false })}>Reject</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
