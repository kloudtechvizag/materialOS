import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Package,
  Plus,
  RefreshCw,
  Send,
  Truck,
  User as UserIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

interface Vehicle {
  id: string;
  registration_number: string;
}
interface Driver {
  id: string;
  name: string;
}
interface Branch {
  id: string;
}
interface Trip {
  id: string;
  trip_date: string;
  status: string;
  vehicle_id: string;
  driver_id: string;
  deliveries: { id: string }[];
}

export function TripsPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");

  // Filters & inspection
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectedTrip, setInspectedTrip] = useState<Trip | null>(null);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiFetch<Branch[]>("/branches"),
  });
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => apiFetch<Vehicle[]>("/vehicles"),
  });
  const { data: drivers } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => apiFetch<Driver[]>("/drivers"),
  });
  const {
    data: trips,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["trips"],
    queryFn: () => apiFetch<Trip[]>("/trips"),
  });

  const vehicleMap = useMemo(() => {
    const map = new Map<string, string>();
    (vehicles || []).forEach((v) => map.set(v.id, v.registration_number));
    return map;
  }, [vehicles]);

  const driverMap = useMemo(() => {
    const map = new Map<string, string>();
    (drivers || []).forEach((d) => map.set(d.id, d.name));
    return map;
  }, [drivers]);

  const createTrip = useMutation({
    mutationFn: () =>
      apiFetch<Trip>("/trips", {
        method: "POST",
        body: {
          branch_id: branches?.[0]?.id,
          vehicle_id: vehicleId,
          driver_id: driverId,
          trip_date: new Date().toISOString().slice(0, 10),
        },
      }),
    onSuccess: (trip) => {
      toast.success("Trip created. Add deliveries to complete the run sheet.");
      navigate(`/trips/${trip.id}`);
    },
  });

  // Filtered trips
  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    return trips.filter((t) => {
      if (activeTab === "planned" && t.status !== "planned") return false;
      if (activeTab === "started" && t.status !== "started") return false;
      if (activeTab === "completed" && t.status !== "completed") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const vReg = (vehicleMap.get(t.vehicle_id) || "").toLowerCase();
        const dName = (driverMap.get(t.driver_id) || "").toLowerCase();
        const dateMatch = t.trip_date.toLowerCase().includes(q);
        if (!vReg.includes(q) && !dName.includes(q) && !dateMatch) return false;
      }

      return true;
    });
  }, [trips, activeTab, searchQuery, vehicleMap, driverMap]);

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!trips) return [];
    const totalCount = trips.length;
    const startedCount = trips.filter((t) => t.status === "started").length;
    const plannedCount = trips.filter((t) => t.status === "planned").length;
    const completedCount = trips.filter((t) => t.status === "completed").length;
    const totalDeliveries = trips.reduce((sum, t) => sum + t.deliveries.length, 0);

    return [
      {
        id: "total",
        label: "Total Trips",
        value: totalCount,
        subvalue: `${totalDeliveries} total drops`,
        icon: Send,
        color: "slate",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "started",
        label: "On the Road / Started",
        value: startedCount,
        subvalue: "En route to destinations",
        icon: Truck,
        color: startedCount > 0 ? "sky" : "slate",
        onClick: () => setActiveTab("started"),
      },
      {
        id: "planned",
        label: "Planned Runs",
        value: plannedCount,
        subvalue: "Staging and loading",
        icon: Clock,
        color: plannedCount > 0 ? "amber" : "slate",
        onClick: () => setActiveTab("planned"),
      },
      {
        id: "completed",
        label: "Completed Deliveries",
        value: completedCount,
        subvalue: "PODs signed off",
        icon: CheckCircle2,
        color: "emerald",
        onClick: () => setActiveTab("completed"),
      },
    ];
  }, [trips]);

  // Attention items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!trips) return [];
    const itemsList: AttentionItem[] = [];

    const plannedNoDeliveries = trips.filter((t) => t.status === "planned" && t.deliveries.length === 0);
    if (plannedNoDeliveries.length > 0) {
      itemsList.push({
        id: "no-deliveries",
        title: `${plannedNoDeliveries.length} Planned Trip${plannedNoDeliveries.length > 1 ? "s" : ""} Without Consignments`,
        count: plannedNoDeliveries.length,
        description: "Trips have been created but need delivery challans attached before vehicle departure.",
        severity: "warning",
        actionLabel: "View Empty Trips",
        onAction: () => setActiveTab("planned"),
      });
    }

    const activeTransit = trips.filter((t) => t.status === "started");
    if (activeTransit.length > 0) {
      itemsList.push({
        id: "active-transit",
        title: `${activeTransit.length} Vehicle Trip${activeTransit.length > 1 ? "s" : ""} Active in Transit`,
        count: activeTransit.length,
        description: "Drivers are on the road; verify delivery receipts upon driver return.",
        severity: "info",
        actionLabel: "Track Runs",
        onAction: () => setActiveTab("started"),
      });
    }

    return itemsList;
  }, [trips]);

  // View tabs
  const viewTabs = useMemo(() => {
    if (!trips) return [];
    const plannedCount = trips.filter((t) => t.status === "planned").length;
    const startedCount = trips.filter((t) => t.status === "started").length;
    const completedCount = trips.filter((t) => t.status === "completed").length;

    return [
      { id: "all", label: "All Trips", count: trips.length },
      { id: "started", label: "In Transit", count: startedCount },
      { id: "planned", label: "Planned", count: plannedCount },
      { id: "completed", label: "Completed", count: completedCount },
    ];
  }, [trips]);

  const handleExportCsv = (rowsToExport = filteredTrips) => {
    downloadCsv("delivery-trips", [
      ["Trip Date", "Vehicle", "Driver", "Status", "Deliveries Count"],
      ...rowsToExport.map((t) => [
        t.trip_date,
        vehicleMap.get(t.vehicle_id) || t.vehicle_id,
        driverMap.get(t.driver_id) || t.driver_id,
        t.status,
        String(t.deliveries.length),
      ]),
    ]);
    toast.success(`Exported ${rowsToExport.length} trips to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Vehicle Trips &amp; Run Sheets"
        subtitle="Consignment dispatch: one vehicle, one driver, multiple customer drops for the day."
        badge={trips ? `${trips.length} trips` : undefined}
        primaryAction={{
          label: showForm ? "Cancel" : "New Trip",
          icon: Plus,
          onClick: () => setShowForm((v) => !v),
          variant: showForm ? "outline" : "default",
        }}
        secondaryActions={[
          {
            label: "Fleet Roster",
            icon: Truck,
            href: "/fleet",
          },
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
        title="Trip Execution Alerts"
        items={attentionItems}
        allClearMessage="All trips are dispatched or scheduled on time. No delayed runs."
      />

      {/* 4. New Trip Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md">
          <CardContent className="space-y-4 pt-6">
            <h3 className="text-base font-semibold text-foreground">Schedule New Delivery Trip</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Assigned Vehicle *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                >
                  <option value="">Select vehicle...</option>
                  {vehicles?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registration_number}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Assigned Driver *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                >
                  <option value="">Select driver...</option>
                  {drivers?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {createTrip.isError && <ErrorState error={createTrip.error} />}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createTrip.mutate()}
                disabled={!vehicleId || !driverId || createTrip.isPending}
              >
                {createTrip.isPending ? "Creating Trip..." : "Create Trip & Assign Drops"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Saved Views & Search */}
      <SavedViews
        tabs={viewTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search vehicle reg #, driver name, date..."
      />

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* Empty states */}
      {trips && trips.length === 0 && !showForm && (
        <SmartEmptyState
          type="first-time"
          icon={Truck}
          title="No delivery trips scheduled"
          description="Create your first trip to assign customer orders, optimize delivery routes, and capture Proof of Delivery (POD)."
          primaryAction={{
            label: "Create First Trip",
            icon: Plus,
            onClick: () => setShowForm(true),
          }}
        />
      )}

      {trips && trips.length > 0 && filteredTrips.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No trips match your filters"
          description={`No trips found in view "${activeTab}" with search "${searchQuery}".`}
          primaryAction={{
            label: "Reset Filter",
            onClick: () => {
              setActiveTab("all");
              setSearchQuery("");
            },
          }}
        />
      )}

      {/* 6. Action-First Trip Cards */}
      {filteredTrips.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTrips.map((t) => {
            const vehicleReg = vehicleMap.get(t.vehicle_id) || "Unassigned Vehicle";
            const driverName = driverMap.get(t.driver_id) || "Unassigned Driver";

            return (
              <Card
                key={t.id}
                className="cursor-pointer border-border transition-all hover:border-primary/50 hover:shadow-sm"
                onClick={() => navigate(`/trips/${t.id}`)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>{t.trip_date}</span>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold text-foreground text-sm">{vehicleReg}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <UserIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Driver: {driverName}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{t.deliveries.length} Deliveries</span>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => navigate(`/trips/${t.id}`)}
                      >
                        Run Sheet &rarr;
                      </Button>
                      <RowActions
                        onView={() => setInspectedTrip(t)}
                        onCopy={() => {
                          navigator.clipboard.writeText(`${t.trip_date} - ${vehicleReg}`);
                          toast.success("Copied trip reference");
                        }}
                        viewLabel="Inspect Trip"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 7. Contextual 360 Detail Drawer */}
      <DetailDrawer
        open={Boolean(inspectedTrip)}
        onOpenChange={(open) => !open && setInspectedTrip(null)}
        title={inspectedTrip ? `Trip on ${inspectedTrip.trip_date}` : ""}
        subtitle={
          inspectedTrip
            ? `Vehicle: ${vehicleMap.get(inspectedTrip.vehicle_id) || "—"}`
            : undefined
        }
        badge={inspectedTrip ? <StatusBadge status={inspectedTrip.status} /> : undefined}
        fullRecordHref={inspectedTrip ? `/trips/${inspectedTrip.id}` : undefined}
        fullRecordLabel="Open Delivery Run Sheet"
        metrics={
          inspectedTrip
            ? [
                {
                  label: "Driver",
                  value: driverMap.get(inspectedTrip.driver_id) || "Unassigned",
                },
                {
                  label: "Deliveries Assigned",
                  value: String(inspectedTrip.deliveries.length),
                },
              ]
            : []
        }
        sections={
          inspectedTrip
            ? [
                {
                  title: "Consignment Actions",
                  content: (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Manage gate pass, route sequence, and individual delivery stops on the trip run sheet.
                      </p>
                      <Button asChild size="sm" className="w-full">
                        <Link to={`/trips/${inspectedTrip.id}`}>
                          View Run Sheet &amp; Stops &rarr;
                        </Link>
                      </Button>
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
