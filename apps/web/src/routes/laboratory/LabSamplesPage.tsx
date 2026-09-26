import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Download,
  FlaskConical,
  Plus,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { QuickAddCodeNameModal } from "@/components/entities/QuickAddCodeNameModal";
import { QuickAddContactModal } from "@/components/entities/QuickAddContactModal";
import { SearchableSelect } from "@/components/entities/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionableHeader,
  AttentionPanel,
  BulkActionBar,
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
import { timeAgo } from "@/lib/format";

interface LabSample {
  id: string;
  sample_number: string;
  client_name: string;
  priority: string;
  status: string;
  collection_datetime: string | null;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
}
interface LabSampleType {
  id: string;
  code: string;
  name: string;
}
interface LabContainer {
  id: string;
  code: string;
  name: string;
}
interface LabTestDefinition {
  id: string;
  code: string;
  name: string;
}

const EMPTY_FORM = {
  client_id: "",
  sample_type_id: "",
  container_id: "",
  priority: "routine",
  test_definition_ids: [] as string[],
};

export function LabSamplesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [quickAddClientOpen, setQuickAddClientOpen] = useState(false);
  const [quickAddSampleTypeOpen, setQuickAddSampleTypeOpen] = useState(false);
  const [quickAddContainerOpen, setQuickAddContainerOpen] = useState(false);

  // Filters & selection
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectedSample, setInspectedSample] = useState<LabSample | null>(null);

  const {
    data: samples,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["lab-samples"],
    queryFn: () => apiFetch<LabSample[]>("/lab/samples"),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-for-lab"],
    queryFn: () => apiFetch<Customer[]>("/customers"),
  });
  const { data: sampleTypes } = useQuery({
    queryKey: ["lab-sample-types"],
    queryFn: () => apiFetch<LabSampleType[]>("/lab/sample-types"),
  });
  const { data: containers } = useQuery({
    queryKey: ["lab-containers"],
    queryFn: () => apiFetch<LabContainer[]>("/lab/containers"),
  });
  const { data: testDefs } = useQuery({
    queryKey: ["lab-test-definitions"],
    queryFn: () => apiFetch<LabTestDefinition[]>("/lab/test-definitions"),
  });

  const createSample = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>("/lab/samples", {
        method: "POST",
        body: { ...form, container_id: form.container_id || null },
      }),
    onSuccess: (sample) => {
      queryClient.invalidateQueries({ queryKey: ["lab-samples"] });
      toast.success("Sample registered successfully.");
      setAddOpen(false);
      setForm(EMPTY_FORM);
      navigate(`/lab/samples/${sample.id}`);
    },
  });

  function toggleTest(id: string) {
    setForm((f) => ({
      ...f,
      test_definition_ids: f.test_definition_ids.includes(id)
        ? f.test_definition_ids.filter((t) => t !== id)
        : [...f.test_definition_ids, id],
    }));
  }

  // Filtered samples
  const filteredSamples = useMemo(() => {
    if (!samples) return [];
    return samples.filter((s) => {
      if (activeTab === "stat" && s.priority !== "stat" && s.priority !== "urgent") return false;
      if (activeTab === "awaiting_accession" && s.status !== "registered") return false;
      if (activeTab === "in_process" && s.status !== "accepted" && s.status !== "in_process") return false;
      if (activeTab === "completed" && s.status !== "completed") return false;
      if (activeTab === "reported" && s.status !== "reported") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = s.sample_number.toLowerCase().includes(q);
        const matchClient = s.client_name.toLowerCase().includes(q);
        const matchPriority = s.priority.toLowerCase().includes(q);
        const matchStatus = s.status.toLowerCase().includes(q);
        if (!matchNumber && !matchClient && !matchPriority && !matchStatus) return false;
      }

      return true;
    });
  }, [samples, activeTab, searchQuery]);

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!samples) return [];
    const totalCount = samples.length;
    const statCount = samples.filter((s) => s.priority === "stat" || s.priority === "urgent").length;
    const awaitingCount = samples.filter((s) => s.status === "registered" || s.status === "accessioned").length;
    const testingCount = samples.filter((s) => s.status === "accepted" || s.status === "in_process").length;
    const reportedCount = samples.filter((s) => s.status === "reported" || s.status === "completed").length;

    return [
      {
        id: "total",
        label: "Total Samples",
        value: totalCount,
        subvalue: "In accession registry",
        icon: FlaskConical,
        color: "slate",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "stat",
        label: "STAT & Urgent TAT",
        value: statCount,
        subvalue: statCount > 0 ? "High priority turnaround" : "None pending",
        icon: Zap,
        color: statCount > 0 ? "rose" : "slate",
        onClick: () => setActiveTab("stat"),
      },
      {
        id: "awaiting",
        label: "Awaiting Accession",
        value: awaitingCount,
        subvalue: "Specimens to accept/reject",
        icon: Clock,
        color: awaitingCount > 0 ? "amber" : "slate",
        onClick: () => setActiveTab("awaiting_accession"),
      },
      {
        id: "testing",
        label: "Under Analysis",
        value: testingCount,
        subvalue: "Tests running",
        icon: FlaskConical,
        color: "sky",
        onClick: () => setActiveTab("in_process"),
      },
      {
        id: "reported",
        label: "Completed & Reported",
        value: reportedCount,
        subvalue: "Results released",
        icon: CheckCircle2,
        color: "emerald",
        onClick: () => setActiveTab("reported"),
      },
    ];
  }, [samples]);

  // Attention items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!samples) return [];
    const itemsList: AttentionItem[] = [];

    const stats = samples.filter(
      (s) => (s.priority === "stat" || s.priority === "urgent") && s.status !== "reported" && s.status !== "completed"
    );
    if (stats.length > 0) {
      itemsList.push({
        id: "stat-urgent",
        title: `${stats.length} STAT / Urgent Sample${stats.length > 1 ? "s" : ""} in Laboratory TAT`,
        count: stats.length,
        description: "Priority turnaround samples require expedited testing and supervisory verification.",
        severity: "critical",
        actionLabel: "View STAT Queue",
        onAction: () => setActiveTab("stat"),
      });
    }

    const unaccessioned = samples.filter((s) => s.status === "registered");
    if (unaccessioned.length > 0) {
      itemsList.push({
        id: "unaccessioned",
        title: `${unaccessioned.length} Sample${unaccessioned.length > 1 ? "s" : ""} Pending Specimen Accessioning`,
        count: unaccessioned.length,
        description: "Specimens received but not yet inspected, barcoded, or accepted.",
        severity: "warning",
        actionLabel: "Accession Queue",
        onAction: () => setActiveTab("awaiting_accession"),
      });
    }

    return itemsList;
  }, [samples]);

  // Saved view tabs
  const viewTabs = useMemo(() => {
    if (!samples) return [];
    const statCount = samples.filter((s) => s.priority === "stat" || s.priority === "urgent").length;
    const awaitingCount = samples.filter((s) => s.status === "registered").length;
    const testingCount = samples.filter((s) => s.status === "accepted" || s.status === "in_process").length;
    const completedCount = samples.filter((s) => s.status === "completed").length;
    const reportedCount = samples.filter((s) => s.status === "reported").length;

    return [
      { id: "all", label: "All Samples", count: samples.length },
      { id: "stat", label: "STAT & Urgent", count: statCount },
      { id: "awaiting_accession", label: "Awaiting Accession", count: awaitingCount },
      { id: "in_process", label: "In Testing", count: testingCount },
      { id: "completed", label: "QC Completed", count: completedCount },
      { id: "reported", label: "Reported", count: reportedCount },
    ];
  }, [samples]);

  // Bulk actions
  const allSelected = filteredSamples.length > 0 && selectedIds.length === filteredSamples.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSamples.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleExportCsv = (rowsToExport = filteredSamples) => {
    downloadCsv("laboratory-samples", [
      ["Sample Number", "Client", "Priority", "Status", "Registered At"],
      ...rowsToExport.map((s) => [s.sample_number, s.client_name, s.priority, s.status, s.created_at]),
    ]);
    toast.success(`Exported ${rowsToExport.length} sample records to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Laboratory Samples &amp; Accessioning"
        subtitle="LIMS pipeline: Register specimen → Accession & Barcode → Accept/Reject → Run Tests → QC Verification → Report."
        badge={samples ? `${samples.length} total` : undefined}
        primaryAction={{
          label: "Register Sample",
          icon: Plus,
          onClick: () => setAddOpen(true),
        }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: () => handleExportCsv(),
          },
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
        title="Turnaround Time (TAT) &amp; Specimen Alerts"
        items={attentionItems}
        allClearMessage="Laboratory workflow is performing on schedule. All STAT specimens are progressing within standard TAT."
      />

      {/* 4. Saved Views & Search */}
      <SavedViews
        tabs={viewTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search sample #, client, priority, status..."
      />

      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* Empty states */}
      {samples && samples.length === 0 && (
        <SmartEmptyState
          type="first-time"
          icon={FlaskConical}
          title="No laboratory samples registered yet"
          description="Register patient or client specimens to assign test batteries, generate container barcodes, and track laboratory analytical workflows."
          primaryAction={{
            label: "Register First Sample",
            icon: Plus,
            onClick: () => setAddOpen(true),
          }}
        />
      )}

      {samples && samples.length > 0 && filteredSamples.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No samples match your filters"
          description={`No specimens found in view "${activeTab}" with search "${searchQuery}".`}
          primaryAction={{
            label: "Reset Filter",
            onClick: () => {
              setActiveTab("all");
              setSearchQuery("");
            },
          }}
        />
      )}

      {/* 5. Action-First Data Grid */}
      {filteredSamples.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                </th>
                <th className="px-4 py-3 font-medium">Sample #</th>
                <th className="px-4 py-3 font-medium">Client / Patient</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="w-24 px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredSamples.map((s) => {
                const isStat = s.priority === "stat" || s.priority === "urgent";

                return (
                  <tr
                    key={s.id}
                    className={`group transition-colors hover:bg-accent/40 ${
                      isStat ? "bg-rose-50/10 dark:bg-rose-950/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.includes(s.id)}
                        onCheckedChange={() => toggleSelectOne(s.id)}
                        aria-label={`Select ${s.sample_number}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/lab/samples/${s.id}`}
                        className="font-medium text-primary hover:underline font-mono"
                      >
                        {s.sample_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{s.client_name}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          s.priority === "stat"
                            ? "destructive"
                            : s.priority === "urgent"
                            ? "secondary"
                            : "outline"
                        }
                        className="capitalize"
                      >
                        {s.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {timeAgo(Date.parse(s.created_at))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActions
                        onView={() => setInspectedSample(s)}
                        onCopy={() => {
                          navigator.clipboard.writeText(s.sample_number);
                          toast.success(`Copied ${s.sample_number}`);
                        }}
                        viewLabel="Inspect Specimen"
                        detailHref={`/lab/samples/${s.id}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            id: "export",
            label: "Export Selected",
            icon: Download,
            onClick: () => {
              const selectedRows = filteredSamples.filter((s) => selectedIds.includes(s.id));
              handleExportCsv(selectedRows);
            },
          },
        ]}
      />

      {/* 7. Contextual 360 Detail Drawer */}
      <DetailDrawer
        open={Boolean(inspectedSample)}
        onOpenChange={(open) => !open && setInspectedSample(null)}
        title={inspectedSample ? `Sample ${inspectedSample.sample_number}` : ""}
        subtitle={inspectedSample ? `Client: ${inspectedSample.client_name}` : undefined}
        badge={inspectedSample ? <StatusBadge status={inspectedSample.status} /> : undefined}
        fullRecordHref={inspectedSample ? `/lab/samples/${inspectedSample.id}` : undefined}
        metrics={
          inspectedSample
            ? [
                { label: "Priority", value: inspectedSample.priority.toUpperCase() },
                { label: "Status", value: inspectedSample.status.replace(/_/g, " ").toUpperCase() },
              ]
            : []
        }
        sections={
          inspectedSample
            ? [
                {
                  title: "Laboratory Workflow Actions",
                  content: (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Registered {inspectedSample.created_at}. Accession the specimen to verify volume, container barcode, and release for analytical bench testing.
                      </p>
                      <Button asChild size="sm" className="w-full">
                        <Link to={`/lab/samples/${inspectedSample.id}`}>
                          Open Sample Workbench &rarr;
                        </Link>
                      </Button>
                    </div>
                  ),
                },
              ]
            : []
        }
      />

      {/* 8. Registration Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register Laboratory Sample</DialogTitle>
            <DialogDescription>
              Creates the specimen record, assigns priority, and orders specified analytical test panels.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Client / Account *</Label>
              <SearchableSelect
                options={(customers ?? []).map((c) => ({ id: c.id, label: c.name }))}
                value={form.client_id}
                onChange={(id) => setForm((f) => ({ ...f, client_id: id }))}
                placeholder="Select client..."
                searchPlaceholder="Search clients..."
                emptyText="No clients match."
                quickAddLabel="Quick Add Client"
                onQuickAdd={() => setQuickAddClientOpen(true)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sample Type *</Label>
                <SearchableSelect
                  options={(sampleTypes ?? []).map((t) => ({ id: t.id, label: t.name, sublabel: t.code }))}
                  value={form.sample_type_id}
                  onChange={(id) => setForm((f) => ({ ...f, sample_type_id: id }))}
                  placeholder="Select type..."
                  searchPlaceholder="Search sample types..."
                  emptyText="No sample types match."
                  quickAddLabel="Quick Add Sample Type"
                  onQuickAdd={() => setQuickAddSampleTypeOpen(true)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Container Type</Label>
                <SearchableSelect
                  options={(containers ?? []).map((c) => ({ id: c.id, label: c.name, sublabel: c.code }))}
                  value={form.container_id}
                  onChange={(id) => setForm((f) => ({ ...f, container_id: id }))}
                  placeholder="Optional container..."
                  searchPlaceholder="Search containers..."
                  emptyText="No containers match."
                  quickAddLabel="Quick Add Container"
                  onQuickAdd={() => setQuickAddContainerOpen(true)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Turnaround Priority</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT (Immediate Emergency Turnaround)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Order Laboratory Tests ({form.test_definition_ids.length} selected)</Label>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-input p-2">
                {(testDefs ?? []).map((td) => (
                  <label
                    key={td.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent/40"
                  >
                    <input
                      type="checkbox"
                      checked={form.test_definition_ids.includes(td.id)}
                      onChange={() => toggleTest(td.id)}
                    />
                    <span>{td.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">({td.code})</span>
                  </label>
                ))}
              </div>
            </div>

            {createSample.isError && <ErrorState error={createSample.error} />}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createSample.mutate()}
              disabled={
                !form.client_id ||
                !form.sample_type_id ||
                form.test_definition_ids.length === 0 ||
                createSample.isPending
              }
            >
              {createSample.isPending ? "Registering..." : "Register & Order Tests"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Modals */}
      <QuickAddContactModal<Customer>
        open={quickAddClientOpen}
        onOpenChange={setQuickAddClientOpen}
        title="Client"
        endpoint="/customers"
        queryKey="customers-for-lab"
        onCreated={(cust) => setForm((f) => ({ ...f, client_id: cust.id }))}
      />

      <QuickAddCodeNameModal<LabSampleType>
        open={quickAddSampleTypeOpen}
        onOpenChange={setQuickAddSampleTypeOpen}
        title="Sample Type"
        endpoint="/lab/sample-types"
        queryKey="lab-sample-types"
        onCreated={(type) => setForm((f) => ({ ...f, sample_type_id: type.id }))}
      />

      <QuickAddCodeNameModal<LabContainer>
        open={quickAddContainerOpen}
        onOpenChange={setQuickAddContainerOpen}
        title="Container"
        endpoint="/lab/containers"
        queryKey="lab-containers"
        onCreated={(cont) => setForm((f) => ({ ...f, container_id: cont.id }))}
      />
    </div>
  );
}
