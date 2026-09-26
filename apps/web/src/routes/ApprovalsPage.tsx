import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionableHeader,
  AttentionPanel,
  DetailDrawer,
  MetricStrip,
  SavedViews,
  SmartEmptyState,
  StatusBadge,
  type AttentionItem,
  type MetricItem,
} from "@/components/workspace";
import { apiFetch, ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";

interface ApprovalRequest {
  id: string;
  rule_id?: string;
  document_type: string;
  document_id: string;
  requested_by_user_id?: string;
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  decided_by_user_id?: string | null;
  decided_at?: string | null;
  created_at: string;
}

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [inspectedRequest, setInspectedRequest] = useState<ApprovalRequest | null>(null);

  // Decision confirmation dialog
  const [decisionModal, setDecisionModal] = useState<{
    open: boolean;
    id: string;
    approve: boolean;
    docType: string;
    docId: string;
    reasonNote: string;
  }>({
    open: false,
    id: "",
    approve: true,
    docType: "",
    docId: "",
    reasonNote: "",
  });

  const {
    data: allRequests,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["approvals-all"],
    queryFn: () => apiFetch<ApprovalRequest[]>("/approvals"),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      apiFetch(`/approvals/${id}/${approve ? "approve" : "reject"}`, {
        method: "POST",
        body: { reason: reason?.trim() || null },
      }),
    onSuccess: (_, variables) => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["approvals-all"] });
      queryClient.invalidateQueries({ queryKey: ["work-queue-approvals"] });
      toast.success(
        variables.approve
          ? "Request approved successfully. Document unblocked."
          : "Request rejected. Document remains on hold."
      );
      setDecisionModal((prev) => ({ ...prev, open: false }));
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Could not process the approval decision.";
      setActionError(msg);
      toast.error(msg);
    },
  });

  // Filtered requests
  const filteredRequests = useMemo(() => {
    if (!allRequests) return [];
    return allRequests.filter((r) => {
      if (activeTab !== "all" && r.status !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchType = r.document_type.toLowerCase().includes(q);
        const matchReason = r.reason?.toLowerCase().includes(q);
        const matchId = r.document_id.toLowerCase().includes(q);
        if (!matchType && !matchReason && !matchId) return false;
      }
      return true;
    });
  }, [allRequests, activeTab, searchQuery]);

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!allRequests) return [];
    const pendingCount = allRequests.filter((r) => r.status === "pending").length;
    const approvedCount = allRequests.filter((r) => r.status === "approved").length;
    const rejectedCount = allRequests.filter((r) => r.status === "rejected").length;

    return [
      {
        id: "pending",
        label: "Awaiting Decision",
        value: pendingCount,
        subvalue: pendingCount > 0 ? "Requires managerial sign-off" : "All cleared",
        icon: Clock,
        color: pendingCount > 0 ? "rose" : "slate",
        onClick: () => setActiveTab("pending"),
      },
      {
        id: "approved",
        label: "Approved Decisions",
        value: approvedCount,
        subvalue: "Overrides authorized",
        icon: CheckCircle2,
        color: "emerald",
        onClick: () => setActiveTab("approved"),
      },
      {
        id: "rejected",
        label: "Rejected Requests",
        value: rejectedCount,
        subvalue: "Transactions declined",
        icon: ShieldAlert,
        color: "slate",
        onClick: () => setActiveTab("rejected"),
      },
      {
        id: "total",
        label: "Total Audited",
        value: allRequests.length,
        subvalue: "Governance history",
        icon: ShieldCheck,
        color: "indigo",
        onClick: () => setActiveTab("all"),
      },
    ];
  }, [allRequests]);

  // Attention items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!allRequests) return [];
    const pending = allRequests.filter((r) => r.status === "pending");
    if (pending.length === 0) return [];

    return [
      {
        id: "pending-approvals",
        title: `${pending.length} Commercial Request${pending.length > 1 ? "s" : ""} on Hold`,
        count: pending.length,
        description: "Orders cannot progress to warehouse allocation or dispatch until approved.",
        severity: "critical",
        actionLabel: "View Pending Queue",
        onAction: () => setActiveTab("pending"),
      },
    ];
  }, [allRequests]);

  // View tabs
  const viewTabs = useMemo(() => {
    if (!allRequests) return [];
    const pendingCount = allRequests.filter((r) => r.status === "pending").length;
    const approvedCount = allRequests.filter((r) => r.status === "approved").length;
    const rejectedCount = allRequests.filter((r) => r.status === "rejected").length;

    return [
      { id: "pending", label: "Pending Review", count: pendingCount },
      { id: "approved", label: "Approved", count: approvedCount },
      { id: "rejected", label: "Rejected", count: rejectedCount },
      { id: "all", label: "All Records", count: allRequests.length },
    ];
  }, [allRequests]);

  function getDocumentUrl(docType: string, docId: string): string | null {
    if (docType === "sales_order") return `/sales-orders/${docId}`;
    if (docType === "quotation") return `/quotations/${docId}`;
    if (docType === "purchase_order") return `/purchase-orders/${docId}`;
    return null;
  }

  return (
    <div className="space-y-6">
      {/* 1. Actionable Header */}
      <ActionableHeader
        title="Approvals Center"
        subtitle="Review and govern credit-limit overrides and blocked commercial transactions."
        badge={
          allRequests
            ? `${allRequests.filter((r) => r.status === "pending").length} pending`
            : undefined
        }
        secondaryActions={[
          {
            label: "Refresh",
            icon: RefreshCw,
            onClick: () => refetch(),
            disabled: isRefetching,
          },
        ]}
      />

      {/* 2. Metrics */}
      <MetricStrip metrics={metrics} />

      {/* 3. Attention Panel */}
      <AttentionPanel
        title="Urgent Decisions Required"
        items={attentionItems}
        allClearMessage="No blocked documents awaiting approval. Commercial policies are running clean."
      />

      {/* 4. Saved Views & Search */}
      <SavedViews
        tabs={viewTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search reason, document type, ID..."
      />

      {actionError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* Empty states */}
      {allRequests && allRequests.length === 0 && (
        <SmartEmptyState
          type="operational"
          icon={ShieldCheck}
          title="No approval requests recorded"
          description="Everything is running within configured risk rules. When an order exceeds credit limits or triggers governance rules, it will appear here."
        />
      )}

      {allRequests && allRequests.length > 0 && filteredRequests.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title={`No ${activeTab} requests found`}
          description={
            searchQuery
              ? `No requests match "${searchQuery}" in ${activeTab} view.`
              : `There are currently 0 requests in the ${activeTab} state.`
          }
          primaryAction={{
            label: "Clear Filter",
            onClick: () => {
              setActiveTab("all");
              setSearchQuery("");
            },
          }}
        />
      )}

      {/* 5. Work Queue Cards */}
      {filteredRequests.length > 0 && (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const docUrl = getDocumentUrl(req.document_type, req.document_id);
            const isPending = req.status === "pending";

            return (
              <Card
                key={req.id}
                className={`transition-all hover:shadow-sm ${
                  isPending ? "border-amber-300/80 bg-amber-50/15 dark:border-amber-800/60" : ""
                }`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground capitalize">
                          {req.document_type.replace(/_/g, " ")}
                        </span>
                        <StatusBadge status={req.status} />
                        <span className="text-xs text-muted-foreground">
                          Requested {timeAgo(Date.parse(req.created_at))}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-foreground">
                        {req.reason || "Credit-limit threshold exceeded on order reservation."}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                        <span>Document ID: <code className="rounded bg-muted px-1 py-0.5">{req.document_id.slice(0, 8)}...</code></span>
                        {docUrl && (
                          <Link
                            to={docUrl}
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            <span>Inspect Source Document</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        {req.decided_at && (
                          <span>Decided {timeAgo(Date.parse(req.decided_at))}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInspectedRequest(req)}
                      >
                        Inspect
                      </Button>

                      {isPending && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              setDecisionModal({
                                open: true,
                                id: req.id,
                                approve: false,
                                docType: req.document_type,
                                docId: req.document_id,
                                reasonNote: "",
                              })
                            }
                            disabled={decideMutation.isPending}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() =>
                              setDecisionModal({
                                open: true,
                                id: req.id,
                                approve: true,
                                docType: req.document_type,
                                docId: req.document_id,
                                reasonNote: "",
                              })
                            }
                            disabled={decideMutation.isPending}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Approve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Decision Confirmation Dialog */}
      <Dialog
        open={decisionModal.open}
        onOpenChange={(open) => setDecisionModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionModal.approve ? "Authorize Exception Override" : "Reject Approval Request"}
            </DialogTitle>
            <DialogDescription>
              {decisionModal.approve
                ? `You are unblocking ${decisionModal.docType.replace(/_/g, " ")}. The order will become eligible for immediate inventory reservation and dispatch.`
                : `You are declining this request. The ${decisionModal.docType.replace(/_/g, " ")} will remain on credit hold.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-muted-foreground">
              Decision Note (Optional audit trail)
            </label>
            <Input
              placeholder={
                decisionModal.approve
                  ? "e.g., Customer confirmed RTGS payment arriving today"
                  : "e.g., Credit limit exhausted; require 50% advance first"
              }
              value={decisionModal.reasonNote}
              onChange={(e) =>
                setDecisionModal((prev) => ({ ...prev, reasonNote: e.target.value }))
              }
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDecisionModal((prev) => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button
              variant={decisionModal.approve ? "default" : "destructive"}
              className={decisionModal.approve ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              onClick={() =>
                decideMutation.mutate({
                  id: decisionModal.id,
                  approve: decisionModal.approve,
                  reason: decisionModal.reasonNote,
                })
              }
              disabled={decideMutation.isPending}
            >
              {decideMutation.isPending
                ? "Recording decision..."
                : decisionModal.approve
                ? "Confirm Approval"
                : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Contextual 360 Detail Drawer */}
      <DetailDrawer
        open={Boolean(inspectedRequest)}
        onOpenChange={(open) => !open && setInspectedRequest(null)}
        title={
          inspectedRequest
            ? `${inspectedRequest.document_type.replace(/_/g, " ").toUpperCase()} Exception`
            : ""
        }
        subtitle={inspectedRequest?.created_at ? `Requested ${timeAgo(Date.parse(inspectedRequest.created_at))}` : undefined}
        badge={inspectedRequest ? <StatusBadge status={inspectedRequest.status} /> : undefined}
        fullRecordHref={
          inspectedRequest
            ? getDocumentUrl(inspectedRequest.document_type, inspectedRequest.document_id) || undefined
            : undefined
        }
        metrics={
          inspectedRequest
            ? [
                { label: "Status", value: inspectedRequest.status.toUpperCase() },
                { label: "Document Type", value: inspectedRequest.document_type },
              ]
            : []
        }
        sections={
          inspectedRequest
            ? [
                {
                  title: "Trigger Reason",
                  content: (
                    <p className="text-sm text-foreground bg-muted/40 p-3 rounded-md">
                      {inspectedRequest.reason || "Credit terms exceeded configured limits."}
                    </p>
                  ),
                },
                {
                  title: "Audit Information",
                  content: (
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Request ID:</span>
                        <span className="font-mono">{inspectedRequest.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Document ID:</span>
                        <span className="font-mono">{inspectedRequest.document_id}</span>
                      </div>
                      {inspectedRequest.decided_at && (
                        <div className="flex justify-between">
                          <span>Decision Timestamp:</span>
                          <span>{inspectedRequest.decided_at}</span>
                        </div>
                      )}
                    </div>
                  ),
                },
              ]
            : []
        }
      />
    </div>
  );
}
