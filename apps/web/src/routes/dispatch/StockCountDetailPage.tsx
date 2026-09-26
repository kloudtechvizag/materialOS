import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Package,
  Send,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricStrip, StatusBadge, type MetricItem } from "@/components/workspace";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  name: string;
  base_uom: string;
}

interface CountItem {
  id: string;
  item_id: string;
  system_qty: string;
  counted_qty: string;
  variance: string;
}

interface StockCount {
  id: string;
  warehouse_id?: string;
  status: string;
  count_date: string;
  items: CountItem[];
}

export function StockCountDetailPage() {
  const { countId } = useParams<{ countId: string }>();
  const queryClient = useQueryClient();
  const [counted, setCounted] = useState<Record<string, string>>({});

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: () => apiFetch<Item[]>("/items"),
  });

  const {
    data: count,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["stock-count", countId],
    queryFn: () => apiFetch<StockCount>(`/stock-counts/${countId}`),
  });

  const submit = useMutation({
    mutationFn: () =>
      apiFetch(`/stock-counts/${countId}/submit`, {
        method: "POST",
        body: { counted_quantities: counted },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-count", countId] });
      queryClient.invalidateQueries({ queryKey: ["stock-counts"] });
      toast.success("Count submitted! Variance calculated and ready for manager approval.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to submit count");
    },
  });

  const approve = useMutation({
    mutationFn: () => apiFetch(`/stock-counts/${countId}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-count", countId] });
      queryClient.invalidateQueries({ queryKey: ["stock-counts"] });
      toast.success("Stock count approved! Ledger inventory adjustments successfully posted.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to approve count");
    },
  });

  const itemName = (id: string) => items?.find((i) => i.id === id)?.name ?? id;
  const itemUom = (id: string) => items?.find((i) => i.id === id)?.base_uom ?? "";

  const metrics: MetricItem[] = useMemo(() => {
    if (!count) return [];
    const totalLines = count.items.length;
    const hasVariance = count.items.filter((i) => Number(i.variance || 0) !== 0).length;

    let netVariance = 0;
    count.items.forEach((i) => {
      netVariance += Number(i.variance || 0);
    });

    return [
      {
        id: "lines",
        label: "Audited Items",
        value: totalLines,
        sublabel: "Distinct SKUs on sheet",
        icon: Package,
        color: "primary",
      },
      {
        id: "variance-count",
        label: "Discrepant Items",
        value: count.status === "draft" ? "Blind" : hasVariance,
        sublabel: count.status === "draft" ? "Hidden until submit" : `${hasVariance} SKUs have non-zero variance`,
        icon: AlertTriangle,
        color: count.status === "draft" ? "neutral" : hasVariance > 0 ? "amber" : "emerald",
      },
      {
        id: "net-variance",
        label: "Net Unit Discrepancy",
        value:
          count.status === "draft"
            ? "Blind"
            : netVariance > 0
            ? `+${netVariance.toFixed(1)}`
            : netVariance.toFixed(1),
        sublabel: count.status === "draft" ? "Hidden until submit" : "Net ledger adjustment",
        icon: count.status === "approved" ? CheckCircle2 : Clock,
        color: count.status === "draft" ? "neutral" : netVariance === 0 ? "emerald" : "amber",
      },
    ];
  }, [count]);

  const exportAuditCsv = () => {
    if (!count) return;
    const headers = ["Item Name", "Book Qty", "Counted Qty", "Variance", "Unit"];
    const rows = count.items.map((line) => [
      itemName(line.item_id),
      line.system_qty,
      line.counted_qty,
      count.status === "draft" ? "Hidden" : line.variance,
      itemUom(line.item_id),
    ]);
    downloadCsv(`stock-audit-${count.count_date}.csv`, [headers, ...rows]);
    toast.success("Audit worksheet exported to CSV");
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!count) return null;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Header */}
      <div>
        <Link
          to="/stock-counts"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Stock Audits
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Physical Count — {count.count_date}
              </h1>
              <StatusBadge status={count.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {count.status === "draft" &&
                "Blind count active. Enter physical floor counts below and click submit to compute variances."}
              {count.status === "submitted" &&
                "Physical count submitted. Review calculated variances below before approving ledger adjustments."}
              {count.status === "approved" &&
                "Audit finalized. System inventory balances have been adjusted to match physical counts."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportAuditCsv}>
              <Download className="h-3.5 w-3.5" />
              Export Sheet
            </Button>

            {count.status === "draft" && (
              <Button
                className="gap-1.5"
                onClick={() => submit.mutate()}
                disabled={submit.isPending}
              >
                <Send className="h-4 w-4" />
                {submit.isPending ? "Submitting..." : "Submit Floor Count"}
              </Button>
            )}

            {count.status === "submitted" && (
              <Button
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                {approve.isPending ? "Approving..." : "Approve & Post Adjustments"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Metric Strip */}
      <MetricStrip metrics={metrics} />

      {/* Variance Alert Banner for Submitted */}
      {count.status === "submitted" && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-50/50 p-4 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Managerial Signoff Required</h4>
            <p className="text-xs opacity-90">
              Review line-item variances below. Approving will automatically generate stock movement
              reconciliation transactions in the system ledger.
            </p>
          </div>
        </div>
      )}

      {(submit.isError || approve.isError) && (
        <ErrorState error={submit.error ?? approve.error} />
      )}

      {/* Main Audit Worksheet Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Audit Items Worksheet</CardTitle>
          <span className="text-xs text-muted-foreground">
            {count.items.length} line items
          </span>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-3 pl-2">Item / SKU</th>
                  <th className="pb-3">Book Qty</th>
                  <th className="pb-3">Physical Count</th>
                  {count.status !== "draft" && <th className="pb-3">Variance</th>}
                  {count.status !== "draft" && <th className="pb-3">Status</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {count.items.map((line) => {
                  const varianceNum = Number(line.variance || 0);

                  return (
                    <tr key={line.id} className="transition-colors hover:bg-muted/40">
                      <td className="py-3 pl-2">
                        <p className="font-medium text-foreground">{itemName(line.item_id)}</p>
                        <span className="text-xs text-muted-foreground">{itemUom(line.item_id)}</span>
                      </td>
                      <td className="py-3 font-mono text-muted-foreground">
                        {count.status === "draft" ? "— (Blind)" : line.system_qty}
                      </td>
                      <td className="py-3">
                        {count.status === "draft" ? (
                          <Input
                            type="number"
                            placeholder="Enter count"
                            className="h-8 w-32 font-mono"
                            defaultValue={line.counted_qty}
                            onChange={(e) =>
                              setCounted((prev) => ({
                                ...prev,
                                [line.item_id]: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          <span className="font-mono font-medium text-foreground">
                            {line.counted_qty}
                          </span>
                        )}
                      </td>
                      {count.status !== "draft" && (
                        <td
                          className={cn(
                            "py-3 font-mono font-semibold",
                            varianceNum > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : varianceNum < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {varianceNum > 0 ? `+${line.variance}` : line.variance}
                        </td>
                      )}
                      {count.status !== "draft" && (
                        <td className="py-3">
                          {varianceNum === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Matched
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              Variance
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
