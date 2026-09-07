import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";

interface ApprovalRequest {
  id: string;
  document_type: string;
  document_id: string;
  status: string;
  reason: string | null;
  created_at: string;
}

const STATUS_VARIANT: Record<string, "outline" | "success" | "destructive"> = {
  pending: "outline",
  approved: "success",
  rejected: "destructive",
};

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["approvals", statusFilter],
    queryFn: () => apiFetch<ApprovalRequest[]>(`/approvals?status=${statusFilter}`),
  });

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      apiFetch(`/approvals/${id}/${approve ? "approve" : "reject"}`, { method: "POST", body: {} }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Could not update the request."),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Requests raised when a document was blocked -- currently only credit-limit overrides on sales orders (ADR-009).
        </p>
      </div>

      <div className="flex gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState icon={ShieldCheck} title={`No ${statusFilter} requests`} description="Blocked documents that need a decision will show up here." />
      )}
      {data && data.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            {data.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{req.document_type.replace("_", " ")}</span>
                    <Badge variant={STATUS_VARIANT[req.status] ?? "outline"}>{req.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{req.reason}</p>
                </div>
                {req.status === "pending" && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => decide.mutate({ id: req.id, approve: false })} disabled={decide.isPending}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => decide.mutate({ id: req.id, approve: true })} disabled={decide.isPending}>
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
