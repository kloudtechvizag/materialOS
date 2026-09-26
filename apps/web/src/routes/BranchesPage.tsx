import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  MapPin,
  Plus,
  RefreshCw,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

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

interface Branch {
  id: string;
  name: string;
  code: string;
  gstin: string | null;
  is_active: boolean;
}

interface Company {
  id: string;
}

export function BranchesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gstin, setGstin] = useState("");

  const [activeView, setActiveView] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewBranch, setPreviewBranch] = useState<Branch | null>(null);

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => apiFetch<Company[]>("/companies"),
  });
  const {
    data: branches = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiFetch<Branch[]>("/branches"),
  });

  const createBranch = useMutation({
    mutationFn: () =>
      apiFetch<Branch>("/branches", {
        method: "POST",
        body: {
          company_id: companies?.[0]?.id,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          gstin: gstin.trim().toUpperCase() || null,
        },
      }),
    onSuccess: (newB) => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast.success(`Branch ${newB.name} registered`);
      setShowForm(false);
      setName("");
      setCode("");
      setGstin("");
    },
  });

  // Business calculations
  const { activeCount, gstinCount, missingGstinCount } = useMemo(() => {
    let active = 0;
    let withGst = 0;
    let noGst = 0;

    for (const b of branches) {
      if (b.is_active) active++;
      if (b.gstin) withGst++;
      else noGst++;
    }

    return {
      activeCount: active,
      gstinCount: withGst,
      missingGstinCount: noGst,
    };
  }, [branches]);

  // Metric Strip
  const metrics: MetricItem[] = useMemo(
    () => [
      {
        id: "total",
        label: "Total Branches",
        value: branches.length,
        sublabel: "Regional footprint",
        icon: Building2,
        color: "violet",
        active: activeView === "all",
        onClick: () => setActiveView("all"),
      },
      {
        id: "active",
        label: "Operational Units",
        value: activeCount,
        sublabel: "Active trading locations",
        icon: CheckCircle2,
        color: "emerald",
        active: activeView === "active",
        onClick: () => setActiveView("active"),
      },
      {
        id: "gstin",
        label: "GST Registered",
        value: gstinCount,
        sublabel: "State tax registrations",
        icon: MapPin,
        color: "sky",
        active: activeView === "gstin",
        onClick: () => setActiveView("gstin"),
      },
      {
        id: "missing-gstin",
        label: "Missing GSTIN",
        value: missingGstinCount,
        sublabel: "Tax compliance check",
        icon: AlertTriangle,
        color: missingGstinCount > 0 ? "amber" : "slate",
        active: activeView === "missing_gstin",
        onClick: () => setActiveView("missing_gstin"),
      },
    ],
    [branches.length, activeCount, gstinCount, missingGstinCount, activeView]
  );

  // Attention / Exceptions
  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];

    if (missingGstinCount > 0) {
      items.push({
        id: "att-branch-gst",
        title: `${missingGstinCount} branch${missingGstinCount > 1 ? "es" : ""} missing state GSTIN`,
        severity: "warning",
        count: missingGstinCount,
        description: "Branch billing without a state GSTIN defaults to the primary company tax ID.",
        actionLabel: "Filter branches",
        onClick: () => setActiveView("missing_gstin"),
      });
    }

    return items;
  }, [missingGstinCount]);

  // Views & Filtering
  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      if (activeView === "active" && !b.is_active) return false;
      if (activeView === "inactive" && b.is_active) return false;
      if (activeView === "gstin" && !b.gstin) return false;
      if (activeView === "missing_gstin" && Boolean(b.gstin)) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const n = b.name.toLowerCase();
        const c = b.code.toLowerCase();
        const g = (b.gstin ?? "").toLowerCase();
        if (!n.includes(q) && !c.includes(q) && !g.includes(q)) return false;
      }

      return true;
    });
  }, [branches, activeView, search]);

  // Selections
  function toggleSelectAll() {
    if (selectedIds.length === filteredBranches.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBranches.map((b) => b.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleExportCsv() {
    const rows = filteredBranches.map((b) => [
      b.name,
      b.code,
      b.gstin ?? "",
      b.is_active ? "Active" : "Inactive",
    ]);
    downloadCsv("materialos_branches.csv", [
      ["Branch Name", "Code", "GSTIN", "Status"],
      ...rows,
    ]);
    toast.success(`Exported ${filteredBranches.length} branch records`);
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Branches & Units"
        subtitle="Multi-location operations, independent GSTIN registrations, and regional hubs."
        badge={{ label: `${branches.length} Branches`, variant: "outline" }}
        primaryAction={{
          label: showForm ? "Cancel" : "Add Branch",
          icon: showForm ? undefined : Plus,
          onClick: () => setShowForm((v) => !v),
          variant: showForm ? "outline" : "default",
        }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: handleExportCsv,
            disabled: branches.length === 0,
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

      {/* New Branch Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md animate-in fade-in slide-in-from-top-2">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">New Operational Branch</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Branches define independent invoice series, regional billing addresses, and warehouses.
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
                <Label htmlFor="branch-name">Branch / Campus Name *</Label>
                <Input
                  id="branch-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vijayawada Regional Branch"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="branch-code">Branch Code *</Label>
                <Input
                  id="branch-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. VJA"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="branch-gstin">State GSTIN (Optional)</Label>
                <Input
                  id="branch-gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="37AAAAA0000A1Z5"
                />
              </div>
            </div>

            {createBranch.isError && <ErrorState error={createBranch.error} />}

            <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createBranch.mutate()}
                disabled={!name.trim() || !code.trim() || createBranch.isPending}
              >
                {createBranch.isPending ? "Creating..." : "Save Branch"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Saved Views & Smart Filters */}
      <SavedViews
        views={[
          { id: "all", label: "All Branches", count: branches.length },
          { id: "active", label: "Operational", count: activeCount },
          { id: "gstin", label: "With GSTIN", count: gstinCount },
          { id: "missing_gstin", label: "Missing GSTIN", count: missingGstinCount },
        ]}
        activeView={activeView}
        onViewChange={setActiveView}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search branch name, code, GSTIN..."
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
        </div>
      )}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* Empty States */}
      {!isLoading && branches.length === 0 && !showForm && (
        <SmartEmptyState
          type="first-time"
          icon={Building2}
          title="No additional branches"
          description="Every workspace starts with a Main Branch. Add regional branches if your organization operates across multiple cities."
          primaryAction={{
            label: "Add Branch",
            icon: Plus,
            onClick: () => setShowForm(true),
          }}
        />
      )}

      {!isLoading && branches.length > 0 && filteredBranches.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No branches match your search"
          description={`No locations found under the "${activeView}" view.`}
          primaryAction={{
            label: "Reset Search",
            onClick: () => {
              setActiveView("all");
              setSearch("");
            },
          }}
        />
      )}

      {/* 5. Main Workspace Table */}
      {!isLoading && filteredBranches.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 p-3 text-center">
                    <Checkbox
                      checked={selectedIds.length === filteredBranches.length && filteredBranches.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3">Branch Name</th>
                  <th className="p-3">Branch Code</th>
                  <th className="p-3">GSTIN Registration</th>
                  <th className="p-3">Operational Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredBranches.map((b) => {
                  const isSelected = selectedIds.includes(b.id);

                  return (
                    <tr
                      key={b.id}
                      className={cn(
                        "group transition-colors hover:bg-accent/40",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      <td className="w-10 p-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(b.id)}
                          aria-label={`Select branch ${b.name}`}
                        />
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => setPreviewBranch(b)}
                              className="font-semibold text-foreground hover:text-primary hover:underline text-left block"
                            >
                              {b.name}
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {b.code}
                        </Badge>
                      </td>

                      <td className="p-3 text-xs">
                        {b.gstin ? (
                          <span className="font-mono font-medium text-foreground">{b.gstin}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Company Default</span>
                        )}
                      </td>

                      <td className="p-3">
                        <StatusBadge
                          status={b.is_active ? "active" : "inactive"}
                          label={b.is_active ? "Operational" : "Closed"}
                        />
                      </td>

                      <td className="p-3 text-right">
                        <RowActions
                          quickActions={[
                            {
                              id: "preview",
                              label: "Peek Details",
                              icon: Eye,
                              onClick: () => setPreviewBranch(b),
                            },
                          ]}
                          actions={[
                            {
                              id: "warehouses",
                              label: "View Branch Warehouses",
                              icon: WarehouseIcon,
                              onClick: () => {
                                window.location.href = `/warehouses`;
                              },
                            },
                            {
                              id: "copy",
                              label: "Copy Branch Code",
                              icon: Copy,
                              onClick: () => {
                                navigator.clipboard.writeText(b.code);
                                toast.success(`Copied ${b.code}`);
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
        totalCount={filteredBranches.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={toggleSelectAll}
        actions={[
          {
            id: "export-selected",
            label: "Export Selected",
            icon: Download,
            onClick: () => {
              const selectedB = branches.filter((b) => selectedIds.includes(b.id));
              downloadCsv("materialos_selected_branches.csv", [
                ["Name", "Code", "GSTIN", "Active"],
                ...selectedB.map((b) => [
                  b.name,
                  b.code,
                  b.gstin ?? "",
                  b.is_active ? "Yes" : "No",
                ]),
              ]);
              toast.success(`Exported ${selectedB.length} branches`);
            },
          },
        ]}
      />

      {/* 7. Contextual Detail Drawer */}
      {previewBranch && (
        <DetailDrawer
          open={!!previewBranch}
          onOpenChange={(open) => !open && setPreviewBranch(null)}
          title={previewBranch.name}
          subtitle={`Branch Code: ${previewBranch.code}`}
          statusBadge={{
            label: previewBranch.is_active ? "Operational" : "Closed",
            variant: previewBranch.is_active ? "success" : "outline",
          }}
          primaryAction={{
            label: "View Warehouses",
            href: `/warehouses`,
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">GSTIN Registration</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {previewBranch.gstin ?? "Company Default"}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Branch Code</p>
                <p className="font-semibold text-foreground font-mono mt-0.5">
                  {previewBranch.code}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Operational Workflows</p>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Link to={`/warehouses`}>
                    <WarehouseIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>View Warehouses in this Branch</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Link to={`/people/employees`}>
                    <Building2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>View Staff Assigned to this Branch</span>
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
