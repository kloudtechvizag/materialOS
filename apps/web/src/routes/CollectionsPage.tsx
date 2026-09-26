import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Clock,
  Download,
  Receipt,
  RefreshCw,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionableHeader,
  AttentionPanel,
  BulkActionBar,
  DetailDrawer,
  MetricStrip,
  NextBestAction,
  RowActions,
  SavedViews,
  SmartEmptyState,
  type AttentionItem,
  type MetricItem,
} from "@/components/workspace";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatINR, formatINRCompact } from "@/lib/format";

interface AgeingLine {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  due_date: string;
  amount_due: string;
  days_overdue: number;
  bucket: string;
  reason: string;
}

interface Dso {
  period_days: number;
  dso: string | null;
}

const BUCKET_VARIANT: Record<string, "outline" | "secondary" | "destructive"> = {
  current: "outline",
  "1-15": "secondary",
  "16-30": "secondary",
  "31-45": "destructive",
  "46+": "destructive",
};

export function CollectionsPage() {
  const [activeTab, setActiveTab] = useState("priority");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectedLine, setInspectedLine] = useState<AgeingLine | null>(null);

  const {
    data: dso,
    isLoading: loadingDso,
    refetch: refetchDso,
    isRefetching: isRefetchingDso,
  } = useQuery({
    queryKey: ["dso"],
    queryFn: () => apiFetch<Dso>("/collections/dso"),
  });

  const {
    data: priority,
    isLoading: loadingPriority,
    error: errorPriority,
    refetch: refetchPriority,
    isRefetching: isRefetchingPriority,
  } = useQuery({
    queryKey: ["collections-priority"],
    queryFn: () => apiFetch<AgeingLine[]>("/collections/priority?limit=100"),
  });

  const {
    data: ageingAll,
    error: errorAgeing,
    refetch: refetchAgeing,
  } = useQuery({
    queryKey: ["collections-ageing"],
    queryFn: () => apiFetch<AgeingLine[]>("/collections/ageing"),
  });

  const refetchAll = () => {
    refetchDso();
    refetchPriority();
    refetchAgeing();
  };

  const isRefetching = isRefetchingDso || isRefetchingPriority;

  // Active dataset
  const activeDataset = activeTab === "all" ? (ageingAll || priority || []) : (priority || []);

  // Filtered dataset
  const filteredLines = useMemo(() => {
    if (!activeDataset) return [];
    return activeDataset.filter((line) => {
      // Tab filter
      if (activeTab === "46+" && line.bucket !== "46+") return false;
      if (activeTab === "31-45" && line.bucket !== "31-45") return false;
      if (activeTab === "1-30" && line.bucket !== "1-15" && line.bucket !== "16-30") return false;
      if (activeTab === "current" && line.bucket !== "current") return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCust = line.customer_name.toLowerCase().includes(q);
        const matchInv = line.invoice_number.toLowerCase().includes(q);
        const matchReason = line.reason?.toLowerCase().includes(q);
        if (!matchCust && !matchInv && !matchReason) return false;
      }

      return true;
    });
  }, [activeDataset, activeTab, searchQuery]);

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    const list = priority || [];
    const totalOverdue = list.reduce((sum, l) => sum + Number(l.amount_due || 0), 0);
    const severeCount = list.filter((l) => l.bucket === "46+").length;
    const moderateCount = list.filter((l) => l.bucket === "31-45" || l.bucket === "16-30").length;

    return [
      {
        id: "dso",
        label: "Days Sales Outstanding",
        value: dso?.dso ? `${dso.dso} days` : "—",
        subvalue: dso?.period_days ? `Trailing ${dso.period_days} days` : undefined,
        icon: TrendingDown,
        color: dso?.dso && Number(dso.dso) > 45 ? "rose" : "emerald",
      },
      {
        id: "overdue-total",
        label: "Overdue Receivables",
        value: formatINRCompact(totalOverdue),
        subvalue: `${list.length} unpaid invoices`,
        icon: Wallet,
        color: totalOverdue > 0 ? "amber" : "slate",
        onClick: () => setActiveTab("priority"),
      },
      {
        id: "severe",
        label: "Severe (46+ Days)",
        value: severeCount,
        subvalue: severeCount > 0 ? "High risk of default" : "None",
        icon: AlertTriangle,
        color: severeCount > 0 ? "rose" : "slate",
        onClick: () => setActiveTab("46+"),
      },
      {
        id: "moderate",
        label: "Aging (16-45 Days)",
        value: moderateCount,
        subvalue: "Follow-up queue",
        icon: Clock,
        color: "orange",
        onClick: () => setActiveTab("31-45"),
      },
    ];
  }, [dso, priority]);

  // Attention items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!priority || priority.length === 0) return [];
    const itemsList: AttentionItem[] = [];

    const severe46 = priority.filter((l) => l.bucket === "46+");
    if (severe46.length > 0) {
      const severeSum = severe46.reduce((sum, l) => sum + Number(l.amount_due), 0);
      itemsList.push({
        id: "severe-46",
        title: `${severe46.length} Critical Account${severe46.length > 1 ? "s" : ""} Overdue 45+ Days`,
        count: severe46.length,
        description: `Total of ${formatINR(severeSum)} past standard payment terms. Credit hold recommended.`,
        severity: "critical",
        actionLabel: "View Critical Bucket",
        onAction: () => setActiveTab("46+"),
      });
    }

    const aging30 = priority.filter((l) => l.bucket === "31-45");
    if (aging30.length > 0) {
      itemsList.push({
        id: "aging-30",
        title: `${aging30.length} Invoices Exceeding 30 Days`,
        count: aging30.length,
        description: "Payment reminders should be dispatched to primary accounting contacts.",
        severity: "warning",
        actionLabel: "View 31-45 Days",
        onAction: () => setActiveTab("31-45"),
      });
    }

    return itemsList;
  }, [priority]);

  // Next Best Action
  const nextAction = useMemo(() => {
    if (!priority || priority.length === 0) return null;
    const highestPriority = priority[0];
    if (!highestPriority) return null;

    return {
      title: "Priority Follow-Up Recommendation",
      recommendation: `Collect ${formatINR(highestPriority.amount_due)} from ${highestPriority.customer_name}`,
      reason: `Invoice ${highestPriority.invoice_number} is ${highestPriority.days_overdue} days overdue (${highestPriority.bucket} bucket).`,
      actionLabel: "Open Customer 360",
      actionHref: `/customers/${highestPriority.customer_id}`,
    };
  }, [priority]);

  // View tabs
  const viewTabs = useMemo(() => {
    const list = priority || [];
    const severeCount = list.filter((l) => l.bucket === "46+").length;
    const bucket31Count = list.filter((l) => l.bucket === "31-45").length;
    const bucket130Count = list.filter((l) => l.bucket === "1-15" || l.bucket === "16-30").length;

    return [
      { id: "priority", label: "Priority Queue", count: list.length },
      { id: "46+", label: "46+ Days", count: severeCount },
      { id: "31-45", label: "31-45 Days", count: bucket31Count },
      { id: "1-30", label: "1-30 Days", count: bucket130Count },
      { id: "all", label: "All Ageing", count: ageingAll?.length ?? list.length },
    ];
  }, [priority, ageingAll]);

  // Bulk actions
  const allSelected = filteredLines.length > 0 && selectedIds.length === filteredLines.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLines.map((l) => l.invoice_id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleExportCsv = (rowsToExport = filteredLines) => {
    downloadCsv("collections-ageing", [
      ["Invoice Number", "Customer Name", "Due Date", "Days Overdue", "Bucket", "Amount Due", "Reason"],
      ...rowsToExport.map((l) => [
        l.invoice_number,
        l.customer_name,
        l.due_date,
        String(l.days_overdue),
        l.bucket,
        l.amount_due,
        l.reason || "",
      ]),
    ]);
    toast.success(`Exported ${rowsToExport.length} receivables records to CSV.`);
  };

  const isLoading = loadingDso || loadingPriority;
  const error = errorPriority || errorAgeing;

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Collections & Accounts Receivable"
        subtitle="Cashflow management: track customer ageing, priority follow-ups, and Days Sales Outstanding (DSO)."
        badge={dso?.dso ? `${dso.dso} Days DSO` : undefined}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: () => handleExportCsv(),
          },
          {
            label: "Refresh",
            icon: RefreshCw,
            onClick: refetchAll,
            disabled: isRefetching,
          },
        ]}
      />

      {/* 2. Metrics */}
      <MetricStrip metrics={metrics} />

      {/* 3. Next Best Action */}
      {nextAction && (
        <NextBestAction
          title={nextAction.title}
          recommendation={nextAction.recommendation}
          reason={nextAction.reason}
          actionLabel={nextAction.actionLabel}
          actionHref={nextAction.actionHref}
        />
      )}

      {/* 4. Attention Panel */}
      <AttentionPanel
        title="Credit Risk & Delinquency Alerts"
        items={attentionItems}
        allClearMessage="Receivables are fully current. No invoices are past due terms."
      />

      {/* 5. Saved Views & Search */}
      <SavedViews
        tabs={viewTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search customer, invoice #, reason..."
      />

      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={refetchAll} />}

      {/* Empty states */}
      {priority && priority.length === 0 && (
        <SmartEmptyState
          type="operational"
          icon={Receipt}
          title="All customer accounts are current"
          description="Every posted invoice is either within standard credit terms or has been fully settled."
        />
      )}

      {priority && priority.length > 0 && filteredLines.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No receivables match your criteria"
          description={`No invoices found in bucket "${activeTab}" with search "${searchQuery}".`}
          primaryAction={{
            label: "Reset Filters",
            onClick: () => {
              setActiveTab("priority");
              setSearchQuery("");
            },
          }}
        />
      )}

      {/* 6. Action-First Data Grid */}
      {filteredLines.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                </th>
                <th className="w-10 px-2 py-3 text-center">#</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Ageing Bucket</th>
                <th className="px-4 py-3 font-medium text-right">Amount Due</th>
                <th className="w-24 px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLines.map((line, idx) => (
                <tr key={line.invoice_id} className="group transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedIds.includes(line.invoice_id)}
                      onCheckedChange={() => toggleSelectOne(line.invoice_id)}
                      aria-label={`Select invoice ${line.invoice_number}`}
                    />
                  </td>
                  <td className="px-2 py-3 text-center text-xs font-medium text-muted-foreground">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/customers/${line.customer_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {line.customer_name}
                    </Link>
                    <p className="text-xs text-muted-foreground line-clamp-1">{line.reason}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{line.invoice_number}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{line.due_date}</div>
                    {line.days_overdue > 0 && (
                      <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                        {line.days_overdue} days late
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={BUCKET_VARIANT[line.bucket] ?? "outline"}>{line.bucket}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {formatINR(line.amount_due)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      onView={() => setInspectedLine(line)}
                      onCopy={() => {
                        navigator.clipboard.writeText(line.invoice_number);
                        toast.success(`Copied ${line.invoice_number}`);
                      }}
                      viewLabel="Inspect Receivables"
                      detailHref={`/customers/${line.customer_id}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 7. Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            id: "export",
            label: "Export Selected",
            icon: Download,
            onClick: () => {
              const selectedRows = filteredLines.filter((l) => selectedIds.includes(l.invoice_id));
              handleExportCsv(selectedRows);
            },
          },
        ]}
      />

      {/* 8. Contextual 360 Detail Drawer */}
      <DetailDrawer
        open={Boolean(inspectedLine)}
        onOpenChange={(open) => !open && setInspectedLine(null)}
        title={inspectedLine ? `Invoice ${inspectedLine.invoice_number}` : ""}
        subtitle={inspectedLine ? `Customer: ${inspectedLine.customer_name}` : undefined}
        badge={
          inspectedLine ? (
            <Badge variant={BUCKET_VARIANT[inspectedLine.bucket] ?? "outline"}>
              {inspectedLine.bucket} bucket
            </Badge>
          ) : undefined
        }
        fullRecordHref={inspectedLine ? `/customers/${inspectedLine.customer_id}` : undefined}
        metrics={
          inspectedLine
            ? [
                { label: "Amount Due", value: formatINR(inspectedLine.amount_due) },
                {
                  label: "Days Overdue",
                  value: `${inspectedLine.days_overdue} days`,
                },
              ]
            : []
        }
        sections={
          inspectedLine
            ? [
                {
                  title: "Prioritization Analysis",
                  content: (
                    <div className="space-y-3">
                      <div className="rounded-md bg-muted/40 p-3 text-sm">
                        <span className="font-medium text-foreground">Follow-up context: </span>
                        <span className="text-muted-foreground">{inspectedLine.reason}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" className="w-full">
                          <Link to={`/customers/${inspectedLine.customer_id}`}>
                            <Users className="mr-1.5 h-4 w-4" /> Open Customer 360
                          </Link>
                        </Button>
                      </div>
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
