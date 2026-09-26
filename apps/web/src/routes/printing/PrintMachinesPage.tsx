import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Clock,
  Download,
  Factory,
  Plus,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionableHeader,
  AttentionPanel,
  MetricStrip,
  SavedViews,
  SmartEmptyState,
  StatusBadge,
  type AttentionItem,
  type MetricItem,
} from "@/components/workspace";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Machine {
  id: string;
  name: string;
  machine_type: string;
  capacity_per_hour: string | number | null;
  capacity_unit: string | null;
  hourly_cost: string;
  status: string;
}

const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-500",
  running: "bg-emerald-500",
  idle: "bg-amber-400",
  maintenance: "bg-amber-500",
  breakdown: "bg-red-500",
  offline: "bg-muted-foreground",
};

export function PrintMachinesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    machine_type: "",
    capacity_per_hour: "",
    capacity_unit: "",
    hourly_cost: "0",
  });

  const {
    data: machines,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["print-machines"],
    queryFn: () => apiFetch<Machine[]>("/print-machines"),
  });

  const createMachine = useMutation({
    mutationFn: () =>
      apiFetch<Machine>("/print-machines", {
        method: "POST",
        body: {
          name: form.name,
          machine_type: form.machine_type,
          capacity_per_hour: form.capacity_per_hour ? Number(form.capacity_per_hour) : null,
          capacity_unit: form.capacity_unit || null,
          hourly_cost: Number(form.hourly_cost),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-machines"] });
      toast.success("Equipment added to pressroom inventory");
      setShowForm(false);
      setForm({
        name: "",
        machine_type: "",
        capacity_per_hour: "",
        capacity_unit: "",
        hourly_cost: "0",
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to add equipment");
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/print-machines/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-machines"] });
      toast.success("Machine status updated");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    },
  });

  // Calculate Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!machines) return [];
    const total = machines.length;
    const running = machines.filter((m) => m.status === "running").length;
    const available = machines.filter(
      (m) => m.status === "available" || m.status === "idle"
    ).length;
    const maintenance = machines.filter(
      (m) => m.status === "maintenance" || m.status === "breakdown"
    ).length;

    return [
      {
        id: "total",
        label: "Total Fleet Machines",
        value: total,
        sublabel: "Press & finishing units",
        icon: Factory,
        color: "primary",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "running",
        label: "Actively Running",
        value: running,
        sublabel: "Executing live print runs",
        icon: Activity,
        color: "emerald",
        onClick: () => setActiveTab("running"),
      },
      {
        id: "available",
        label: "Available / Idle",
        value: available,
        sublabel: "Ready for job dispatch",
        icon: Clock,
        color: "blue",
        onClick: () => setActiveTab("available"),
      },
      {
        id: "maintenance",
        label: "Maintenance & Breakdown",
        value: maintenance,
        sublabel: "Requiring engineering check",
        icon: Wrench,
        color: maintenance > 0 ? "amber" : "neutral",
        onClick: () => setActiveTab("maintenance"),
      },
    ];
  }, [machines]);

  // Attention Items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!machines) return [];
    const list: AttentionItem[] = [];

    const breakdowns = machines.filter((m) => m.status === "breakdown");
    if (breakdowns.length > 0) {
      list.push({
        id: "breakdown-machines",
        title: `${breakdowns.length} equipment unit${breakdowns.length > 1 ? "s" : ""} reported in breakdown`,
        description: "Immediate mechanical downtime. Re-route jobs to alternate presses.",
        severity: "critical",
        count: breakdowns.length,
        actionLabel: "View Downed Units",
        onAction: () => setActiveTab("maintenance"),
      });
    }

    const maintenance = machines.filter((m) => m.status === "maintenance");
    if (maintenance.length > 0) {
      list.push({
        id: "maintenance-machines",
        title: `${maintenance.length} machine${maintenance.length > 1 ? "s" : ""} undergoing scheduled maintenance`,
        description: "Routine roller calibration and lubrication in progress.",
        severity: "warning",
        count: maintenance.length,
        actionLabel: "View Maintenance",
        onAction: () => setActiveTab("maintenance"),
      });
    }

    return list;
  }, [machines]);

  // Filtered machines
  const filteredMachines = useMemo(() => {
    if (!machines) return [];
    return machines.filter((m) => {
      if (activeTab === "running" && m.status !== "running") return false;
      if (activeTab === "available" && m.status !== "available" && m.status !== "idle")
        return false;
      if (activeTab === "maintenance" && m.status !== "maintenance" && m.status !== "breakdown")
        return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const name = m.name.toLowerCase();
        const type = m.machine_type.toLowerCase();
        if (!name.includes(query) && !type.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [machines, activeTab, search]);

  // Tabs
  const tabs = useMemo(() => {
    if (!machines) return [];
    return [
      { id: "all", label: "All Equipment", count: machines.length },
      {
        id: "running",
        label: "Running",
        count: machines.filter((m) => m.status === "running").length,
      },
      {
        id: "available",
        label: "Available / Idle",
        count: machines.filter((m) => m.status === "available" || m.status === "idle").length,
      },
      {
        id: "maintenance",
        label: "Maintenance / Down",
        count: machines.filter((m) => m.status === "maintenance" || m.status === "breakdown").length,
      },
    ];
  }, [machines]);

  const exportCsv = () => {
    if (!machines) return;
    const headers = ["Machine Name", "Type", "Capacity / Hr", "Unit", "Hourly Cost", "Status"];
    const rows = machines.map((m) => [
      m.name,
      m.machine_type,
      m.capacity_per_hour ?? "",
      m.capacity_unit ?? "",
      m.hourly_cost,
      m.status,
    ]);
    downloadCsv("pressroom-machines.csv", [headers, ...rows]);
    toast.success(`Exported ${machines.length} machine records`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Pressroom Equipment & Machine Center"
        description="Monitor offset and digital presses, finishing machines, hourly cost recovery rates, and operational maintenance status."
        primaryAction={{
          label: showForm ? "Close Form" : "Add Machine",
          icon: showForm ? undefined : Plus,
          onClick: () => setShowForm((v) => !v),
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
        title="Pressroom Operational Maintenance"
        items={attentionItems}
        allClearMessage="All presses and finishing machines are online and operational. Zero breakdowns."
      />

      {/* 4. Add Machine Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Register Equipment Unit</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Machine Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Heidelberg 4-Color Speedmaster"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Machine Type *</Label>
                <Input
                  value={form.machine_type}
                  onChange={(e) => setForm((f) => ({ ...f, machine_type: e.target.value }))}
                  placeholder="e.g. Sheetfed Offset, Digital Press, Die-Cutter"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Hourly Cost (₹) *</Label>
                <Input
                  type="number"
                  value={form.hourly_cost}
                  onChange={(e) => setForm((f) => ({ ...f, hourly_cost: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Speed Capacity / Hour</Label>
                <Input
                  type="number"
                  value={form.capacity_per_hour}
                  onChange={(e) => setForm((f) => ({ ...f, capacity_per_hour: e.target.value }))}
                  placeholder="e.g. 8000"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Capacity Unit</Label>
                <Input
                  value={form.capacity_unit}
                  onChange={(e) => setForm((f) => ({ ...f, capacity_unit: e.target.value }))}
                  placeholder="e.g. sheets, impressions, folds"
                />
              </div>
            </div>

            {createMachine.isError && <ErrorState error={createMachine.error} />}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMachine.mutate()}
                disabled={!form.name || !form.machine_type || createMachine.isPending}
              >
                {createMachine.isPending ? "Saving..." : "Save Equipment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Saved Views & Search */}
      <SavedViews
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter machines by name or type..."
      />

      {/* 6. Machines Grid */}
      {isLoading && <Skeleton className="h-48 w-full" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !error && filteredMachines.length === 0 && (
        <SmartEmptyState
          mode={search || activeTab !== "all" ? "filtered" : "first-time"}
          title={
            search || activeTab !== "all"
              ? "No matching machines"
              : "No pressroom machines registered"
          }
          description={
            search || activeTab !== "all"
              ? "Try resetting your search query or tab filter."
              : "Add your offset presses, digital printers, and bindery equipment to track pressroom capacity."
          }
          actionLabel={search || activeTab !== "all" ? "Reset Filters" : "Add First Machine"}
          onAction={() => {
            if (search || activeTab !== "all") {
              setSearch("");
              setActiveTab("all");
            } else {
              setShowForm(true);
            }
          }}
        />
      )}

      {!isLoading && !error && filteredMachines.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMachines.map((m) => (
            <Card key={m.id} className="transition-all hover:shadow-md border-border">
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full animate-pulse",
                        STATUS_DOT[m.status] ?? "bg-muted-foreground"
                      )}
                    />
                    <h4 className="font-semibold text-foreground">{m.name}</h4>
                  </div>
                  <StatusBadge status={m.status} />
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{m.machine_type}</p>
                  {m.capacity_per_hour && (
                    <p>
                      Rated Speed:{" "}
                      <span className="font-semibold text-foreground">
                        {m.capacity_per_hour} {m.capacity_unit ?? ""}/hr
                      </span>
                    </p>
                  )}
                  <p>
                    Hourly Charge Rate:{" "}
                    <span className="font-semibold text-foreground">
                      {formatINR(m.hourly_cost)}/hr
                    </span>
                  </p>
                </div>

                <div className="pt-2 border-t border-border">
                  <Label className="text-[11px] text-muted-foreground">Update Live Status</Label>
                  <select
                    className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    value={m.status}
                    onChange={(e) => updateStatus.mutate({ id: m.id, status: e.target.value })}
                    disabled={updateStatus.isPending}
                  >
                    {[
                      { val: "available", label: "Available (Ready)" },
                      { val: "running", label: "Running (Printing)" },
                      { val: "idle", label: "Idle (No Job)" },
                      { val: "maintenance", label: "Maintenance" },
                      { val: "breakdown", label: "Breakdown (Halted)" },
                      { val: "offline", label: "Offline" },
                    ].map((s) => (
                      <option key={s.val} value={s.val}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
