import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Building2,
  Copy,
  Download,
  Eye,
  Layers,
  Plus,
  RefreshCw,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/entities/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

interface Warehouse {
  id: string;
  branch_id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface Branch {
  id: string;
  name: string;
}

export function WarehousesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [branchId, setBranchId] = useState("");

  const [activeView, setActiveView] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewWarehouse, setPreviewWarehouse] = useState<Warehouse | null>(null);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiFetch<Branch[]>("/branches"),
  });
  const {
    data: warehouses = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => apiFetch<Warehouse[]>("/warehouses"),
  });

  const branchById = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  const createWarehouse = useMutation({
    mutationFn: () =>
      apiFetch<Warehouse>("/warehouses", {
        method: "POST",
        body: { branch_id: branchId, name, code: code.toUpperCase() },
      }),
    onSuccess: (newWh) => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success(`Warehouse ${newWh.name} created`);
      setShowForm(false);
      setName("");
      setCode("");
      setBranchId("");
    },
  });

  // Business calculations
  const { activeCount, inactiveCount, branchesCovered } = useMemo(() => {
    let active = 0;
    let inactive = 0;
    const branchSet = new Set<string>();

    for (const w of warehouses) {
      if (w.is_active) active++;
      else inactive++;
      if (w.branch_id) branchSet.add(w.branch_id);
    }

    return {
      activeCount: active,
      inactiveCount: inactive,
      branchesCovered: branchSet.size,
    };
  }, [warehouses]);

  // Metric Strip
  const metrics: MetricItem[] = useMemo(
    () => [
      {
        id: "total",
        label: "Total Locations",
        value: warehouses.length,
        sublabel: "Storage godowns",
        icon: WarehouseIcon,
        color: "violet",
        active: activeView === "all",
        onClick: () => setActiveView("all"),
      },
      {
        id: "active",
        label: "Active Godowns",
        value: activeCount,
        sublabel: "Operational for dispatch",
        icon: WarehouseIcon,
        color: "emerald",
        active: activeView === "active",
        onClick: () => setActiveView("active"),
      },
      {
        id: "branches",
        label: "Branch Coverage",
        value: `${branchesCovered} / ${branches.length || 1}`,
        sublabel: "Branches with godowns",
        icon: Building2,
        color: "sky",
      },
      {
        id: "inactive",
        label: "Inactive Locations",
        value: inactiveCount,
        sublabel: "Decommissioned / closed",
        icon: AlertTriangle,
        color: inactiveCount > 0 ? "amber" : "slate",
        active: activeView === "inactive",
        onClick: () => setActiveView("inactive"),
      },
    ],
    [
      warehouses.length,
      activeCount,
      branchesCovered,
      branches.length,
      inactiveCount,
      activeView,
    ]
  );

  // Attention / Exceptions
  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];

    if (inactiveCount > 0) {
      items.push({
        id: "att-inactive",
        title: `${inactiveCount} inactive warehouse location${inactiveCount > 1 ? "s" : ""}`,
        severity: "warning",
        count: inactiveCount,
        description: "Verify that zero inventory remains allocated to inactive godown codes.",
        actionLabel: "View inactive",
        onClick: () => setActiveView("inactive"),
      });
    }

    if (branches.length > branchesCovered) {
      const uncovered = branches.length - branchesCovered;
      items.push({
        id: "att-uncovered",
        title: `${uncovered} branch${uncovered > 1 ? "es" : ""} without assigned godown`,
        severity: "info",
        count: uncovered,
        description: "Branch offices cannot fulfill delivery challans without a linked storage location.",
        actionLabel: "Add warehouse",
        onClick: () => setShowForm(true),
      });
    }

    return items;
  }, [inactiveCount, branches.length, branchesCovered]);

  // Views & Filtering
  const filteredWarehouses = useMemo(() => {
    return warehouses.filter((w) => {
      // Saved views
      if (activeView === "active" && !w.is_active) return false;
      if (activeView === "inactive" && w.is_active) return false;

      // Branch filter
      if (selectedBranch && w.branch_id !== selectedBranch) return false;

      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const n = w.name.toLowerCase();
        const c = w.code.toLowerCase();
        const b = (branchById.get(w.branch_id) ?? "").toLowerCase();
        if (!n.includes(q) && !c.includes(q) && !b.includes(q)) return false;
      }

      return true;
    });
  }, [warehouses, activeView, selectedBranch, search, branchById]);

  // Selections
  function toggleSelectAll() {
    if (selectedIds.length === filteredWarehouses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredWarehouses.map((w) => w.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleExportCsv() {
    const rows = filteredWarehouses.map((w) => [
      w.name,
      w.code,
      branchById.get(w.branch_id) ?? w.branch_id,
      w.is_active ? "Active" : "Inactive",
    ]);
    downloadCsv("materialos_warehouses.csv", [
      ["Warehouse Name", "Code", "Branch", "Status"],
      ...rows,
    ]);
    toast.success(`Exported ${filteredWarehouses.length} warehouse records`);
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Warehouses & Storage"
        subtitle="Godowns and stock holding locations across your branch network."
        badge={{ label: `${warehouses.length} Locations`, variant: "outline" }}
        primaryAction={{
          label: showForm ? "Cancel" : "Add Warehouse",
          icon: showForm ? undefined : Plus,
          onClick: () => setShowForm((v) => !v),
          variant: showForm ? "outline" : "default",
        }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: handleExportCsv,
            disabled: warehouses.length === 0,
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

      {/* New Warehouse Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md animate-in fade-in slide-in-from-top-2">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">New Warehouse Location</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Register a godown or stock yard linked to an operational branch.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="wh-name">Warehouse Name *</Label>
                <Input
                  id="wh-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Visakhapatnam Main Godown"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wh-code">Godown Code *</Label>
                <Input
                  id="wh-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. VIZ-WH1"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wh-branch">Assigned Branch *</Label>
                <SearchableSelect
                  options={branches.map((b) => ({ id: b.id, label: b.name }))}
                  value={branchId}
                  onChange={setBranchId}
                  placeholder="Select branch..."
                  searchPlaceholder="Search branches..."
                />
              </div>
            </div>

            {createWarehouse.isError && <ErrorState error={createWarehouse.error} />}

            <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createWarehouse.mutate()}
                disabled={!name.trim() || !code.trim() || !branchId || createWarehouse.isPending}
              >
                {createWarehouse.isPending ? "Creating..." : "Save Warehouse"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Saved Views & Smart Filters */}
      <SavedViews
        views={[
          { id: "all", label: "All Locations", count: warehouses.length },
          { id: "active", label: "Active", count: activeCount },
          { id: "inactive", label: "Inactive", count: inactiveCount },
        ]}
        activeView={activeView}
        onViewChange={setActiveView}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search warehouse name, code..."
        hasActiveFilters={Boolean(selectedBranch || search || activeView !== "all")}
        onClearFilters={() => {
          setSelectedBranch("");
          setSearch("");
          setActiveView("all");
        }}
      >
        {branches.length > 0 && (
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            aria-label="Filter by branch"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-medium"
          >
            <option value="">All Branches ({branches.length})</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </SavedViews>

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
      {!isLoading && warehouses.length === 0 && !showForm && (
        <SmartEmptyState
          type="first-time"
          icon={WarehouseIcon}
          title="No warehouses configured yet"
          description="Create your first warehouse or stock yard to start receiving inventory and making dispatches."
          tip="Warehouses represent physical storage facilities linked to your branches."
          primaryAction={{
            label: "Add Warehouse",
            icon: Plus,
            onClick: () => setShowForm(true),
          }}
        />
      )}

      {!isLoading && warehouses.length > 0 && filteredWarehouses.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No warehouses match your filter"
          description={`No locations found matching the "${activeView}" view and active search filters.`}
          primaryAction={{
            label: "Clear Filters",
            onClick: () => {
              setActiveView("all");
              setSearch("");
              setSelectedBranch("");
            },
          }}
        />
      )}

      {/* 5. Main Workspace Table */}
      {!isLoading && filteredWarehouses.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 p-3 text-center">
                    <Checkbox
                      checked={selectedIds.length === filteredWarehouses.length && filteredWarehouses.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3">Warehouse Name</th>
                  <th className="p-3">Godown Code</th>
                  <th className="p-3">Linked Branch</th>
                  <th className="p-3">Operational Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredWarehouses.map((w) => {
                  const isSelected = selectedIds.includes(w.id);

                  return (
                    <tr
                      key={w.id}
                      className={cn(
                        "group transition-colors hover:bg-accent/40",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      <td className="w-10 p-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(w.id)}
                          aria-label={`Select warehouse ${w.name}`}
                        />
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <WarehouseIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => setPreviewWarehouse(w)}
                              className="font-semibold text-foreground hover:text-primary hover:underline text-left"
                            >
                              {w.name}
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {w.code}
                        </Badge>
                      </td>

                      <td className="p-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 opacity-70" />
                          <span>{branchById.get(w.branch_id) ?? "—"}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        <StatusBadge
                          status={w.is_active ? "active" : "inactive"}
                          label={w.is_active ? "Active Godown" : "Inactive"}
                        />
                      </td>

                      <td className="p-3 text-right">
                        <RowActions
                          quickActions={[
                            {
                              id: "preview",
                              label: "Peek Details",
                              icon: Eye,
                              onClick: () => setPreviewWarehouse(w),
                            },
                          ]}
                          actions={[
                            {
                              id: "stock-ledger",
                              label: "View Stock Movements",
                              icon: ArrowRight,
                              onClick: () => {
                                window.location.href = `/stock-ledger?warehouse_id=${w.id}`;
                              },
                            },
                            {
                              id: "transfer",
                              label: "Initiate Transfer",
                              icon: ArrowLeftRight,
                              onClick: () => {
                                window.location.href = `/transfers`;
                              },
                            },
                            {
                              id: "copy",
                              label: "Copy Warehouse Code",
                              icon: Copy,
                              onClick: () => {
                                navigator.clipboard.writeText(w.code);
                                toast.success(`Copied ${w.code}`);
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
        totalCount={filteredWarehouses.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={toggleSelectAll}
        actions={[
          {
            id: "export-selected",
            label: "Export Selected",
            icon: Download,
            onClick: () => {
              const selectedWhs = warehouses.filter((w) => selectedIds.includes(w.id));
              downloadCsv("materialos_selected_warehouses.csv", [
                ["Name", "Code", "Branch", "Active"],
                ...selectedWhs.map((w) => [
                  w.name,
                  w.code,
                  branchById.get(w.branch_id) ?? "",
                  w.is_active ? "Yes" : "No",
                ]),
              ]);
              toast.success(`Exported ${selectedWhs.length} warehouses`);
            },
          },
        ]}
      />

      {/* 7. Contextual Detail Drawer */}
      {previewWarehouse && (
        <DetailDrawer
          open={!!previewWarehouse}
          onOpenChange={(open) => !open && setPreviewWarehouse(null)}
          title={previewWarehouse.name}
          subtitle={`Location Code: ${previewWarehouse.code}`}
          statusBadge={{
            label: previewWarehouse.is_active ? "Active Godown" : "Inactive",
            variant: previewWarehouse.is_active ? "success" : "outline",
          }}
          primaryAction={{
            label: "Stock Movements",
            href: `/stock-ledger?warehouse_id=${previewWarehouse.id}`,
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Linked Branch</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {branchById.get(previewWarehouse.branch_id) ?? "—"}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Godown Code</p>
                <p className="font-semibold text-foreground font-mono mt-0.5">
                  {previewWarehouse.code}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Operational Workflows</p>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Link to={`/stock-ledger?warehouse_id=${previewWarehouse.id}`}>
                    <ArrowRight className="mr-2 h-3.5 w-3.5 text-primary" />
                    <span>View Stock Ledger for this Godown</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Link to={`/batches`}>
                    <Layers className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>Inspect Stored Batches & Expiry Dates</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Link to={`/transfers`}>
                    <ArrowLeftRight className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>Plan Inter-Warehouse Transfer</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
