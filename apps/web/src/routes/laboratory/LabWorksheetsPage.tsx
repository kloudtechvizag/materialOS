import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FlaskConical,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
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

interface Worksheet {
  id: string;
  worksheet_number: string;
  test_definition_id: string;
  test_name: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

interface TestDefinition {
  id: string;
  code: string;
  name: string;
}

export function LabWorksheetsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [testDefinitionId, setTestDefinitionId] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedWorksheet, setSelectedWorksheet] = useState<Worksheet | null>(null);

  const {
    data: worksheets,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["lab-worksheets"],
    queryFn: () => apiFetch<Worksheet[]>("/lab/worksheets"),
  });

  const { data: testDefs } = useQuery({
    queryKey: ["lab-test-definitions"],
    queryFn: () => apiFetch<TestDefinition[]>("/lab/test-definitions"),
  });

  const createWorksheet = useMutation({
    mutationFn: () =>
      apiFetch<Worksheet>("/lab/worksheets", {
        method: "POST",
        body: { test_definition_id: testDefinitionId },
      }),
    onSuccess: (worksheet) => {
      queryClient.invalidateQueries({ queryKey: ["lab-worksheets"] });
      toast.success("Analytical worksheet batch created");
      setAddOpen(false);
      setTestDefinitionId("");
      navigate(`/lab/worksheets/${worksheet.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create worksheet");
    },
  });

  // Calculate Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!worksheets) return [];
    const total = worksheets.length;
    const inProgress = worksheets.filter(
      (w) => w.status === "in_progress" || w.status === "open"
    ).length;
    const completed = worksheets.filter((w) => w.status === "completed").length;

    return [
      {
        id: "total",
        label: "Total Worksheets",
        value: total,
        sublabel: "Analytical batch runs",
        icon: ClipboardList,
        color: "primary",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "in_progress",
        label: "Batches In Progress",
        value: inProgress,
        sublabel: "Active bench analysis",
        icon: Clock,
        color: inProgress > 0 ? "blue" : "neutral",
        onClick: () => setActiveTab("in_progress"),
      },
      {
        id: "completed",
        label: "Completed Batches",
        value: completed,
        sublabel: "Testing finalized & QC verified",
        icon: CheckCircle2,
        color: "emerald",
        onClick: () => setActiveTab("completed"),
      },
      {
        id: "tests",
        label: "Test Catalog Definitions",
        value: testDefs?.length ?? 0,
        sublabel: "Configured test types",
        icon: FlaskConical,
        color: "neutral",
      },
    ];
  }, [worksheets, testDefs]);

  // Attention Items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!worksheets) return [];
    const list: AttentionItem[] = [];

    const activeBatches = worksheets.filter(
      (w) => w.status === "in_progress" || w.status === "open"
    );
    if (activeBatches.length > 0) {
      list.push({
        id: "active-batches",
        title: `${activeBatches.length} analytical worksheet${activeBatches.length > 1 ? "s" : ""} pending completion`,
        description: "Assigned bench technicians need to enter analyte observations and review control blanks.",
        severity: "info",
        count: activeBatches.length,
        actionLabel: "View Active Batches",
        onAction: () => setActiveTab("in_progress"),
      });
    }

    return list;
  }, [worksheets]);

  // Filtered worksheets
  const filteredWorksheets = useMemo(() => {
    if (!worksheets) return [];
    return worksheets.filter((w) => {
      if (activeTab === "in_progress" && w.status !== "in_progress" && w.status !== "open") {
        return false;
      }
      if (activeTab === "completed" && w.status !== "completed") {
        return false;
      }

      if (search.trim()) {
        const query = search.toLowerCase();
        const num = (w.worksheet_number || "").toLowerCase();
        const testName = (w.test_name || "").toLowerCase();
        if (!num.includes(query) && !testName.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [worksheets, activeTab, search]);

  // Tabs
  const tabs = useMemo(() => {
    if (!worksheets) return [];
    const inProg = worksheets.filter(
      (w) => w.status === "in_progress" || w.status === "open"
    ).length;
    const comp = worksheets.filter((w) => w.status === "completed").length;

    return [
      { id: "all", label: "All Worksheets", count: worksheets.length },
      { id: "in_progress", label: "Active Testing", count: inProg },
      { id: "completed", label: "Completed", count: comp },
    ];
  }, [worksheets]);

  const exportCsv = () => {
    if (!worksheets) return;
    const headers = ["Worksheet #", "Test Name", "Status", "Created At", "Completed At"];
    const rows = worksheets.map((w) => [
      w.worksheet_number,
      w.test_name,
      w.status,
      w.created_at,
      w.completed_at ?? "",
    ]);
    downloadCsv("lab-worksheets.csv", [headers, ...rows]);
    toast.success(`Exported ${worksheets.length} worksheet records`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Laboratory Worksheets & Batch Testing"
        description="Group sample orders by test definition into analytical batches, record QC controls, and verify bench measurements."
        primaryAction={{
          label: "New Worksheet",
          icon: Plus,
          onClick: () => setAddOpen(true),
        }}
        secondaryActions={[
          {
            label: "Export CSV",
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
        title="LIMS Testing Queue"
        items={attentionItems}
        allClearMessage="All analytical worksheets completed and verified. No open testing backlog."
      />

      {/* 4. Saved Views & Search */}
      <SavedViews
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by worksheet number or test..."
      />

      {/* 5. Main Worksheet Grid / Table */}
      {isLoading && <Skeleton className="h-48 w-full" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !error && filteredWorksheets.length === 0 && (
        <SmartEmptyState
          mode={search || activeTab !== "all" ? "filtered" : "first-time"}
          title={
            search || activeTab !== "all"
              ? "No matching worksheets"
              : "No analytical worksheets created yet"
          }
          description={
            search || activeTab !== "all"
              ? "Try adjusting your search query or switching tabs."
              : "Create a worksheet to batch-process samples for an identical test run."
          }
          actionLabel={search || activeTab !== "all" ? "Reset Filters" : "Create First Worksheet"}
          onAction={() => {
            if (search || activeTab !== "all") {
              setSearch("");
              setActiveTab("all");
            } else {
              setAddOpen(true);
            }
          }}
        />
      )}

      {!isLoading && !error && filteredWorksheets.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {filteredWorksheets.map((w) => (
            <div
              key={w.id}
              className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{w.worksheet_number}</span>
                  <StatusBadge status={w.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{w.test_name}</span>
                  <span>&bull;</span>
                  <span>Created {new Date(w.created_at).toLocaleDateString()}</span>
                  {w.completed_at && (
                    <>
                      <span>&bull;</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Completed {new Date(w.completed_at).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => navigate(`/lab/worksheets/${w.id}`)}
                >
                  <span>Worksheet</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>

                <RowActions
                  onQuickPeek={() => setSelectedWorksheet(w)}
                  actions={[
                    {
                      label: "Open Analytical Bench",
                      icon: FlaskConical,
                      onClick: () => navigate(`/lab/worksheets/${w.id}`),
                    },
                    {
                      label: "Quick Snapshot",
                      icon: Eye,
                      onClick: () => setSelectedWorksheet(w),
                    },
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6. Quick Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedWorksheet}
        onClose={() => setSelectedWorksheet(null)}
        title={selectedWorksheet?.worksheet_number ?? "Worksheet"}
        subtitle="Analytical Batch Run Overview"
        badge={selectedWorksheet?.status ? <StatusBadge status={selectedWorksheet.status} /> : undefined}
        metrics={[
          {
            label: "Test Parameter",
            value: selectedWorksheet?.test_name ?? "—",
          },
          {
            label: "Status",
            value: selectedWorksheet?.status?.toUpperCase() ?? "—",
          },
          {
            label: "Created",
            value: selectedWorksheet ? new Date(selectedWorksheet.created_at).toLocaleDateString() : "—",
          },
        ]}
        actions={
          selectedWorksheet ? (
            <Button
              className="gap-1.5"
              onClick={() => navigate(`/lab/worksheets/${selectedWorksheet.id}`)}
            >
              <FlaskConical className="h-4 w-4" />
              Open Bench Testing
            </Button>
          ) : undefined
        }
      >
        <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
          Open the bench testing sheet to enter sample instrument readings, verify calibration blanks, and sign off results.
        </div>
      </DetailDrawer>

      {/* 7. New Worksheet Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Analytical Worksheet</DialogTitle>
            <DialogDescription>
              Groups queued test orders for a single test definition into an analytical batch run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Select Test Definition *</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={testDefinitionId}
              onChange={(e) => setTestDefinitionId(e.target.value)}
            >
              <option value="">Select test parameter...</option>
              {(testDefs ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </select>
          </div>
          {createWorksheet.isError && <ErrorState error={createWorksheet.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createWorksheet.mutate()}
              disabled={!testDefinitionId || createWorksheet.isPending}
            >
              {createWorksheet.isPending ? "Creating..." : "Initialize Worksheet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
