import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  FileCheck,
  FileText,
  Plus,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { cn } from "@/lib/utils";

interface Quotation {
  id: string;
  number: string;
  status: string;
  total: string;
  quote_date: string;
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  draft: "outline",
  approved: "secondary",
  converted: "success",
  rejected: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  converted: "Converted to Order",
  rejected: "Rejected",
};

export function QuotationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "all";

  const [activeView, setActiveView] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewQuote, setPreviewQuote] = useState<Quotation | null>(null);

  const {
    data: quotations = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["quotations"],
    queryFn: () => apiFetch<Quotation[]>("/quotations"),
  });

  // Business calculations
  const {
    draftCount,
    approvedCount,
    convertedCount,
    rejectedCount,
    totalPipelineValue,
  } = useMemo(() => {
    let draft = 0;
    let approved = 0;
    let converted = 0;
    let rejected = 0;
    let totalVal = 0;

    for (const q of quotations) {
      totalVal += Number(q.total) || 0;
      if (q.status === "draft") draft++;
      if (q.status === "approved") approved++;
      if (q.status === "converted") converted++;
      if (q.status === "rejected") rejected++;
    }

    return {
      draftCount: draft,
      approvedCount: approved,
      convertedCount: converted,
      rejectedCount: rejected,
      totalPipelineValue: totalVal,
    };
  }, [quotations]);

  // Metric Strip
  const metrics: MetricItem[] = useMemo(
    () => [
      {
        id: "total",
        label: "Total Quotations",
        value: quotations.length,
        sublabel: "Deal proposals",
        icon: FileText,
        color: "violet",
        active: activeView === "all",
        onClick: () => setActiveView("all"),
      },
      {
        id: "draft",
        label: "Draft Quotes",
        value: draftCount,
        sublabel: "In preparation",
        icon: Clock,
        color: "sky",
        active: activeView === "draft",
        onClick: () => setActiveView("draft"),
      },
      {
        id: "approved",
        label: "Approved Quotes",
        value: approvedCount,
        sublabel: "Ready to convert to order",
        icon: FileCheck,
        color: approvedCount > 0 ? "emerald" : "slate",
        active: activeView === "approved",
        onClick: () => setActiveView("approved"),
      },
      {
        id: "converted",
        label: "Converted (Won)",
        value: convertedCount,
        sublabel: "Converted into Sales Orders",
        icon: CheckCircle2,
        color: "indigo",
        active: activeView === "converted",
        onClick: () => setActiveView("converted"),
      },
      {
        id: "pipeline-value",
        label: "Gross Pipeline Value",
        value: formatINRCompact(totalPipelineValue),
        sublabel: "Total quoted value",
        icon: TrendingUp,
        color: "emerald",
      },
    ],
    [
      quotations.length,
      draftCount,
      approvedCount,
      convertedCount,
      totalPipelineValue,
      activeView,
    ]
  );

  // Attention / Exceptions
  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];

    if (approvedCount > 0) {
      items.push({
        id: "att-approved",
        title: `${approvedCount} approved quote${approvedCount > 1 ? "s" : ""} awaiting conversion`,
        severity: "success",
        count: approvedCount,
        description: "Customer or management has approved. Convert to Sales Order to reserve godown inventory.",
        actionLabel: "Convert quotes",
        onClick: () => setActiveView("approved"),
      });
    }

    if (draftCount > 0) {
      items.push({
        id: "att-draft",
        title: `${draftCount} draft quotation${draftCount > 1 ? "s" : ""} pending submission`,
        severity: "info",
        count: draftCount,
        description: "Draft quotes not yet finalized or sent to the customer.",
        actionLabel: "Review drafts",
        onClick: () => setActiveView("draft"),
      });
    }

    return items;
  }, [approvedCount, draftCount]);

  // Views & Filtering
  const filteredQuotes = useMemo(() => {
    return quotations.filter((q) => {
      // Saved views
      if (activeView !== "all" && q.status !== activeView) {
        return false;
      }

      // Search
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const num = q.number.toLowerCase();
        const date = (q.quote_date ?? "").toLowerCase();
        const status = (STATUS_LABEL[q.status] ?? q.status).toLowerCase();
        if (!num.includes(query) && !date.includes(query) && !status.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [quotations, activeView, search]);

  // Selection
  function toggleSelectAll() {
    if (selectedIds.length === filteredQuotes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQuotes.map((q) => q.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleExportCsv() {
    const rows = filteredQuotes.map((q) => [
      q.number,
      q.quote_date,
      STATUS_LABEL[q.status] ?? q.status,
      q.total,
    ]);
    downloadCsv("materialos_quotations.csv", [
      ["Quotation Number", "Quote Date", "Status", "Total Amount (₹)"],
      ...rows,
    ]);
    toast.success(`Exported ${filteredQuotes.length} quotations`);
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Quotations"
        subtitle="Sales estimation, real-time margin visibility, stock availability check, and order conversion."
        badge={{ label: `${quotations.length} Quotes`, variant: "outline" }}
        primaryAction={{
          label: "New Quotation",
          icon: Plus,
          href: "/quotations/new",
        }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: handleExportCsv,
            disabled: quotations.length === 0,
          },
          {
            label: "Refresh",
            icon: RefreshCw,
            onClick: () => refetch(),
            disabled: isRefetching,
          },
        ]}
      />

      {/* 2. Context KPI Strip */}
      <MetricStrip metrics={metrics} />

      {/* 3. Attention / Exceptions */}
      <AttentionPanel items={attentionItems} />

      {/* Next Best Action if approved quotes exist */}
      {approvedCount > 0 && activeView !== "approved" && (
        <NextBestAction
          title="Conversion Opportunity"
          badge={`${approvedCount} Ready`}
          recommendation={`${approvedCount} approved quotation${approvedCount > 1 ? "s are" : " is"} ready for order conversion.`}
          reason="Converting reserves godown stock immediately and initiates the dispatch workflow."
          actionLabel="View Approved Quotes"
          onAction={() => setActiveView("approved")}
        />
      )}

      {/* 4. Saved Views & Smart Filters */}
      <SavedViews
        views={[
          { id: "all", label: "All Quotations", count: quotations.length },
          { id: "approved", label: "Approved", count: approvedCount },
          { id: "draft", label: "Draft", count: draftCount },
          { id: "converted", label: "Converted", count: convertedCount },
          { id: "rejected", label: "Rejected", count: rejectedCount },
        ]}
        activeView={activeView}
        onViewChange={setActiveView}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search quotation number or date..."
        hasActiveFilters={Boolean(search || activeView !== "all")}
        onClearFilters={() => {
          setSearch("");
          setActiveView("all");
        }}
      />

      {/* Loading & Error States */}
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* Empty States */}
      {!isLoading && quotations.length === 0 && (
        <SmartEmptyState
          type="first-time"
          icon={FileText}
          title="No quotations drafted yet"
          description="Create your first quotation with automatic product pricing and stock verification."
          tip="Approved quotations can be converted into sales orders with one click."
          primaryAction={{
            label: "Create First Quotation",
            icon: Plus,
            href: "/quotations/new",
          }}
        />
      )}

      {!isLoading && quotations.length > 0 && filteredQuotes.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No quotations match your filter"
          description={`No records found under the "${activeView}" view with current search criteria.`}
          primaryAction={{
            label: "Reset View Filters",
            onClick: () => {
              setActiveView("all");
              setSearch("");
            },
          }}
        />
      )}

      {/* 5. Main Workspace Table */}
      {!isLoading && filteredQuotes.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 p-3 text-center">
                    <Checkbox
                      checked={selectedIds.length === filteredQuotes.length && filteredQuotes.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3">Quotation Number</th>
                  <th className="p-3">Quotation Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Quoted Total</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredQuotes.map((q) => {
                  const isSelected = selectedIds.includes(q.id);
                  const isApproved = q.status === "approved";

                  return (
                    <tr
                      key={q.id}
                      className={cn(
                        "group transition-colors hover:bg-accent/40",
                        isSelected && "bg-primary/5",
                        isApproved && "bg-emerald-50/20 dark:bg-emerald-950/10"
                      )}
                    >
                      <td className="w-10 p-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(q.id)}
                          aria-label={`Select quotation ${q.number}`}
                        />
                      </td>

                      <td className="p-3">
                        <Link
                          to={`/quotations/${q.id}`}
                          className="font-semibold text-primary hover:underline text-left block"
                        >
                          {q.number}
                        </Link>
                      </td>

                      <td className="p-3 text-xs text-muted-foreground">
                        {q.quote_date ? new Date(q.quote_date).toLocaleDateString("en-IN") : "—"}
                      </td>

                      <td className="p-3">
                        <Badge variant={STATUS_VARIANT[q.status] ?? "outline"} className="text-xs">
                          {STATUS_LABEL[q.status] ?? q.status}
                        </Badge>
                      </td>

                      <td className="p-3 text-right font-semibold font-mono text-xs">
                        {formatINR(q.total)}
                      </td>

                      <td className="p-3 text-right">
                        <RowActions
                          quickActions={[
                            {
                              id: "preview",
                              label: "Peek Details",
                              icon: Eye,
                              onClick: () => setPreviewQuote(q),
                            },
                          ]}
                          actions={[
                            {
                              id: "open",
                              label: "Open Quotation",
                              icon: ArrowRight,
                              onClick: () => navigate(`/quotations/${q.id}`),
                            },
                            {
                              id: "copy",
                              label: "Copy Quote Number",
                              icon: Copy,
                              onClick: () => {
                                navigator.clipboard.writeText(q.number);
                                toast.success(`Copied ${q.number}`);
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        totalCount={filteredQuotes.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={toggleSelectAll}
        actions={[
          {
            id: "export-selected",
            label: "Export Selected",
            icon: Download,
            onClick: () => {
              const selectedQuotes = quotations.filter((q) => selectedIds.includes(q.id));
              downloadCsv("materialos_selected_quotations.csv", [
                ["Quotation Number", "Date", "Status", "Total"],
                ...selectedQuotes.map((q) => [
                  q.number,
                  q.quote_date,
                  STATUS_LABEL[q.status] ?? q.status,
                  q.total,
                ]),
              ]);
              toast.success(`Exported ${selectedQuotes.length} quotations`);
            },
          },
        ]}
      />

      {/* 7. Contextual Detail Drawer */}
      {previewQuote && (
        <DetailDrawer
          open={!!previewQuote}
          onOpenChange={(open) => !open && setPreviewQuote(null)}
          title={`Quotation ${previewQuote.number}`}
          subtitle={`Quoted on ${previewQuote.quote_date}`}
          statusBadge={{
            label: STATUS_LABEL[previewQuote.status] ?? previewQuote.status,
            variant: STATUS_VARIANT[previewQuote.status] ?? "outline",
          }}
          fullRecordHref={`/quotations/${previewQuote.id}`}
          fullRecordLabel="Open Quotation Workspace"
          primaryAction={{
            label: previewQuote.status === "approved" ? "Convert to Order" : "Open Quotation",
            href: `/quotations/${previewQuote.id}`,
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Total Quoted Amount</p>
                <p className="text-base font-bold font-mono mt-0.5 text-foreground">
                  {formatINR(previewQuote.total)}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Proposal Status</p>
                <p className="font-semibold text-foreground mt-0.5 capitalize">
                  {STATUS_LABEL[previewQuote.status] ?? previewQuote.status}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2 text-xs">
              <p className="font-semibold text-foreground">Deal Lifecycle</p>
              <p className="text-muted-foreground leading-relaxed">
                {previewQuote.status === "approved"
                  ? "This quotation is approved and ready to be converted into a confirmed Sales Order."
                  : previewQuote.status === "converted"
                  ? "This quotation has already been converted into a live Sales Order."
                  : "Draft proposal. Review items, taxes, discounts, and submit for customer approval."}
              </p>
              <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs mt-2">
                <Link to={`/quotations/${previewQuote.id}`}>
                  <ArrowRight className="mr-2 h-3.5 w-3.5 text-primary" />
                  <span>Inspect Line Items & Margins</span>
                </Link>
              </Button>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
