import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface LeaveType { id: string; code: string; name: string; annual_allocation_days: string; is_paid: boolean; }
interface LeaveBalance { leave_type_id: string; allocated_days: string; used_days: string; carried_forward_days: string; }
interface LeaveRequest {
  id: string; employee_id: string; leave_type_id: string; start_date: string; end_date: string;
  days: string; reason: string | null; status: string;
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  pending: "secondary", approved: "success", rejected: "destructive", cancelled: "outline",
};

/** /people/leave -- request + approve, and a real balance readout
 * (spec sec26-30). Team requests only render for someone holding
 * leave.view/leave.approve; the query 403ing is treated as "nothing to
 * show here" rather than an error banner, since a regular employee
 * legitimately has no team queue. */
export function LeavePage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });

  const { data: leaveTypes } = useQuery({ queryKey: ["leave-types"], queryFn: () => apiFetch<LeaveType[]>("/leave/types") });
  const { data: balances } = useQuery({ queryKey: ["leave-balance-me"], queryFn: () => apiFetch<LeaveBalance[]>("/leave/balance/me"), retry: false });
  const { data: myRequests, isLoading, error, refetch } = useQuery({ queryKey: ["my-leave-requests"], queryFn: () => apiFetch<LeaveRequest[]>("/leave/requests/me"), retry: false });
  const { data: teamRequests } = useQuery({ queryKey: ["team-leave-requests", "pending"], queryFn: () => apiFetch<LeaveRequest[]>("/leave/requests?status=pending"), retry: false });

  const typeById = new Map((leaveTypes ?? []).map((t) => [t.id, t.name]));

  const requestLeave = useMutation({
    mutationFn: () => apiFetch<LeaveRequest>("/leave/requests", { method: "POST", body: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
      setShowForm(false);
      setForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
    },
  });

  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => apiFetch(`/leave/requests/${id}/review`, { method: "POST", body: { approve } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balance-me"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leave</h1>
          <p className="text-sm text-muted-foreground">Request leave and track your balance.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Request leave"}</Button>
      </div>

      {balances && balances.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {balances.map((b) => (
            <Card key={b.leave_type_id}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{typeById.get(b.leave_type_id) ?? "Leave"}</p>
                <p className="text-xl font-semibold">{(Number(b.allocated_days) + Number(b.carried_forward_days) - Number(b.used_days)).toFixed(1)} left</p>
                <p className="text-xs text-muted-foreground">{b.used_days} used of {b.allocated_days}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Request leave</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Leave type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.leave_type_id} onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))}>
                <option value="">Select type</option>
                {leaveTypes?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div />
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Reason</Label>
              <Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
            {requestLeave.isError && <ErrorState error={requestLeave.error} />}
            <div className="sm:col-span-2">
              <Button onClick={() => requestLeave.mutate()} disabled={!form.leave_type_id || !form.start_date || !form.end_date || requestLeave.isPending}>
                {requestLeave.isPending ? "Submitting..." : "Submit request"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {teamRequests && teamRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pending team requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {teamRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div>
                  <p>{typeById.get(r.leave_type_id) ?? "Leave"} &middot; {r.start_date} to {r.end_date} ({r.days} days)</p>
                  {r.reason && <p className="text-xs text-muted-foreground">{r.reason}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => review.mutate({ id: r.id, approve: true })}>Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => review.mutate({ id: r.id, approve: false })}>Reject</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">My requests</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-24" />}
          {error && <ErrorState error={error} onRetry={() => refetch()} />}
          {myRequests && myRequests.length === 0 && <EmptyState icon={CalendarDays} title="No leave requests yet" description="Submit a request above when you need time off." />}
          {myRequests && myRequests.length > 0 && (
            <div className="space-y-2">
              {myRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span>{typeById.get(r.leave_type_id) ?? "Leave"} &middot; {r.start_date} to {r.end_date}</span>
                  <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>{r.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
