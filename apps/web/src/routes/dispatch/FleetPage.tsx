import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Download,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Truck,
  User as UserIcon,
  Users,
  Weight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
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
  vehicle_type: string;
  capacity_kg: string;
}

interface Driver {
  id: string;
  name: string;
  phone: string | null;
}

interface Branch {
  id: string;
  name?: string;
}

export function FleetPage() {
  const queryClient = useQueryClient();
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiFetch<Branch[]>("/branches"),
  });

  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    registration_number: "",
    vehicle_type: "",
    capacity_kg: "0",
  });

  const [showDriverModal, setShowDriverModal] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: "", phone: "" });

  // Filter & Search state
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectedVehicle, setInspectedVehicle] = useState<Vehicle | null>(null);
  const [inspectedDriver, setInspectedDriver] = useState<Driver | null>(null);

  const {
    data: vehicles,
    isLoading: loadingVehicles,
    error: vehiclesError,
    refetch: refetchVehicles,
    isRefetching: isRefetchingVehicles,
  } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => apiFetch<Vehicle[]>("/vehicles"),
  });

  const {
    data: drivers,
    isLoading: loadingDrivers,
    error: driversError,
    refetch: refetchDrivers,
    isRefetching: isRefetchingDrivers,
  } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => apiFetch<Driver[]>("/drivers"),
  });

  const refetchAll = () => {
    refetchVehicles();
    refetchDrivers();
  };
  const isRefetching = isRefetchingVehicles || isRefetchingDrivers;

  const createVehicle = useMutation({
    mutationFn: () =>
      apiFetch<Vehicle>("/vehicles", {
        method: "POST",
        body: {
          ...vehicleForm,
          capacity_kg: Number(vehicleForm.capacity_kg),
          branch_id: branches?.[0]?.id,
        },
      }),
    onSuccess: (v) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success(`Vehicle ${v.registration_number} added to fleet.`);
      setShowVehicleModal(false);
      setVehicleForm({ registration_number: "", vehicle_type: "", capacity_kg: "0" });
    },
  });

  const createDriver = useMutation({
    mutationFn: () =>
      apiFetch<Driver>("/drivers", {
        method: "POST",
        body: { ...driverForm, branch_id: branches?.[0]?.id },
      }),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success(`Driver ${d.name} added to roster.`);
      setShowDriverModal(false);
      setDriverForm({ name: "", phone: "" });
    },
  });

  // Filtered lists
  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    if (activeTab === "drivers") return [];
    return vehicles.filter((v) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchReg = v.registration_number.toLowerCase().includes(q);
        const matchType = v.vehicle_type.toLowerCase().includes(q);
        if (!matchReg && !matchType) return false;
      }
      return true;
    });
  }, [vehicles, activeTab, searchQuery]);

  const filteredDrivers = useMemo(() => {
    if (!drivers) return [];
    if (activeTab === "vehicles") return [];
    return drivers.filter((d) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = d.name.toLowerCase().includes(q);
        const matchPhone = (d.phone || "").includes(q);
        if (!matchName && !matchPhone) return false;
      }
      return true;
    });
  }, [drivers, activeTab, searchQuery]);

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    const vCount = vehicles?.length ?? 0;
    const dCount = drivers?.length ?? 0;
    const totalCapacityKg = (vehicles ?? []).reduce(
      (sum, v) => sum + Number(v.capacity_kg || 0),
      0
    );
    const capacityTons = (totalCapacityKg / 1000).toFixed(1);

    return [
      {
        id: "vehicles",
        label: "Fleet Vehicles",
        value: vCount,
        subvalue: "Active trucks & vans",
        icon: Truck,
        color: "slate",
        onClick: () => setActiveTab("vehicles"),
      },
      {
        id: "drivers",
        label: "Driver Roster",
        value: dCount,
        subvalue: "Available operators",
        icon: Users,
        color: "emerald",
        onClick: () => setActiveTab("drivers"),
      },
      {
        id: "capacity",
        label: "Payload Capacity",
        value: `${capacityTons} MT`,
        subvalue: `${totalCapacityKg.toLocaleString()} kg total`,
        icon: Weight,
        color: "sky",
      },
      {
        id: "branches",
        label: "Operating Bases",
        value: branches?.length ?? 1,
        subvalue: "Distribution hubs",
        icon: Building2,
        color: "indigo",
      },
    ];
  }, [vehicles, drivers, branches]);

  // Attention items
  const attentionItems: AttentionItem[] = useMemo(() => {
    const itemsList: AttentionItem[] = [];
    const vCount = vehicles?.length ?? 0;
    const dCount = drivers?.length ?? 0;

    if (vCount > 0 && dCount === 0) {
      itemsList.push({
        id: "no-drivers",
        title: "Fleet Vehicles Registered Without Any Drivers",
        count: vCount,
        description: "You have vehicles configured but no drivers registered to execute trips.",
        severity: "critical",
        actionLabel: "Add Driver",
        onAction: () => setShowDriverModal(true),
      });
    }

    const unassignedCapacity = (vehicles || []).filter((v) => Number(v.capacity_kg) === 0);
    if (unassignedCapacity.length > 0) {
      itemsList.push({
        id: "zero-capacity",
        title: `${unassignedCapacity.length} Vehicle${unassignedCapacity.length > 1 ? "s" : ""} With 0 kg Capacity`,
        count: unassignedCapacity.length,
        description: "Payload weight limits are required for automatic trip loading checks.",
        severity: "warning",
      });
    }

    return itemsList;
  }, [vehicles, drivers]);

  // View tabs
  const viewTabs = useMemo(() => {
    return [
      { id: "all", label: "Fleet & Drivers", count: (vehicles?.length ?? 0) + (drivers?.length ?? 0) },
      { id: "vehicles", label: "Vehicles Only", count: vehicles?.length ?? 0 },
      { id: "drivers", label: "Drivers Only", count: drivers?.length ?? 0 },
    ];
  }, [vehicles, drivers]);

  const handleExportCsv = () => {
    downloadCsv("fleet-roster", [
      ["Type", "Name / Registration", "Type / Phone", "Capacity (kg)"],
      ...(vehicles || []).map((v) => ["Vehicle", v.registration_number, v.vehicle_type, v.capacity_kg]),
      ...(drivers || []).map((d) => ["Driver", d.name, d.phone || "", "—"]),
    ]);
    toast.success("Exported fleet and driver roster to CSV.");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Fleet &amp; Logistics Roster"
        subtitle="Manage commercial transport: register trucks, vans, payloads, and drivers for dispatch trip assignment."
        badge={
          vehicles && drivers
            ? `${vehicles.length} vehicles · ${drivers.length} drivers`
            : undefined
        }
        primaryAction={{
          label: "Add Vehicle",
          icon: Plus,
          onClick: () => setShowVehicleModal(true),
        }}
        secondaryActions={[
          {
            label: "Add Driver",
            icon: UserIcon,
            onClick: () => setShowDriverModal(true),
          },
          {
            label: "Export CSV",
            icon: Download,
            onClick: handleExportCsv,
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

      {/* 3. Attention Panel */}
      <AttentionPanel
        title="Fleet Availability &amp; Compliance Alerts"
        items={attentionItems}
        allClearMessage="Fleet roster is balanced. Sufficient registered vehicles and drivers available for trip dispatch."
      />

      {/* 4. Saved Views & Search */}
      <SavedViews
        tabs={viewTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search registration #, vehicle type, driver name, phone..."
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/trips">
            <Send className="mr-1.5 h-3.5 w-3.5 text-primary" /> Active Trips
          </Link>
        </Button>
      </SavedViews>

      {(loadingVehicles || loadingDrivers) && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {(vehiclesError || driversError) && (
        <ErrorState error={vehiclesError || driversError} onRetry={refetchAll} />
      )}

      {/* 5. Dual Workspace (Vehicles & Drivers) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Vehicles */}
        {(activeTab === "all" || activeTab === "vehicles") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Fleet Vehicles</h2>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowVehicleModal(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Vehicle
              </Button>
            </div>

            {vehicles && vehicles.length === 0 && (
              <SmartEmptyState
                type="first-time"
                icon={Truck}
                title="No vehicles in fleet"
                description="Add trucks, tempos, or trailers to assign to delivery trips."
                primaryAction={{
                  label: "Add First Vehicle",
                  icon: Plus,
                  onClick: () => setShowVehicleModal(true),
                }}
              />
            )}

            {filteredVehicles.map((v) => (
              <Card
                key={v.id}
                className="cursor-pointer border-border transition-all hover:border-primary/50 hover:shadow-sm"
                onClick={() => setInspectedVehicle(v)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{v.registration_number}</span>
                      <Badge variant="outline">{v.vehicle_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Max payload capacity: <strong className="text-foreground">{Number(v.capacity_kg).toLocaleString()} kg</strong>
                    </p>
                  </div>
                  <RowActions
                    onView={() => setInspectedVehicle(v)}
                    onCopy={() => {
                      navigator.clipboard.writeText(v.registration_number);
                      toast.success(`Copied ${v.registration_number}`);
                    }}
                    viewLabel="Inspect Vehicle"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Right Column: Drivers */}
        {(activeTab === "all" || activeTab === "drivers") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-emerald-600" />
                <h2 className="text-base font-semibold text-foreground">Driver Roster</h2>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowDriverModal(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Driver
              </Button>
            </div>

            {drivers && drivers.length === 0 && (
              <SmartEmptyState
                type="first-time"
                icon={UserIcon}
                title="No drivers registered"
                description="Register drivers to assign them to vehicle dispatch routes."
                primaryAction={{
                  label: "Add First Driver",
                  icon: Plus,
                  onClick: () => setShowDriverModal(true),
                }}
              />
            )}

            {filteredDrivers.map((d) => (
              <Card
                key={d.id}
                className="cursor-pointer border-border transition-all hover:border-emerald-500/50 hover:shadow-sm"
                onClick={() => setInspectedDriver(d)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{d.name}</span>
                      <StatusBadge status="active" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{d.phone || "No phone registered"}</span>
                    </div>
                  </div>
                  <RowActions
                    onView={() => setInspectedDriver(d)}
                    onCopy={() => {
                      navigator.clipboard.writeText(d.name);
                      toast.success(`Copied ${d.name}`);
                    }}
                    viewLabel="Inspect Driver"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 6. Vehicle Modal */}
      <Dialog open={showVehicleModal} onOpenChange={setShowVehicleModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Fleet Vehicle</DialogTitle>
            <DialogDescription>
              Record registration number, body type, and payload weight limit for trip assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Registration Number *</Label>
              <Input
                value={vehicleForm.registration_number}
                onChange={(e) =>
                  setVehicleForm((f) => ({ ...f, registration_number: e.target.value }))
                }
                placeholder="e.g. AP31AB1234, MH04DE5678"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vehicle Type *</Label>
              <Input
                value={vehicleForm.vehicle_type}
                onChange={(e) =>
                  setVehicleForm((f) => ({ ...f, vehicle_type: e.target.value }))
                }
                placeholder="e.g. 6-Wheeler Tipper, 10-Tonne Eicher, Delivery Van"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payload Capacity (kg) *</Label>
              <Input
                type="number"
                value={vehicleForm.capacity_kg}
                onChange={(e) =>
                  setVehicleForm((f) => ({ ...f, capacity_kg: e.target.value }))
                }
                placeholder="e.g. 10000"
              />
            </div>
          </div>
          {createVehicle.isError && <ErrorState error={createVehicle.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVehicleModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createVehicle.mutate()}
              disabled={!vehicleForm.registration_number.trim() || createVehicle.isPending}
            >
              {createVehicle.isPending ? "Saving..." : "Save Vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Driver Modal */}
      <Dialog open={showDriverModal} onOpenChange={setShowDriverModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Commercial Driver</DialogTitle>
            <DialogDescription>
              Register driver contact credentials for trip dispatch communication and Proof of Delivery.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Driver Full Name *</Label>
              <Input
                value={driverForm.name}
                onChange={(e) => setDriverForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ramesh Naidu"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input
                value={driverForm.phone}
                onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
          {createDriver.isError && <ErrorState error={createDriver.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDriverModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createDriver.mutate()}
              disabled={!driverForm.name.trim() || createDriver.isPending}
            >
              {createDriver.isPending ? "Saving..." : "Save Driver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 8. Vehicle Detail Drawer */}
      <DetailDrawer
        open={Boolean(inspectedVehicle)}
        onOpenChange={(open) => !open && setInspectedVehicle(null)}
        title={inspectedVehicle ? inspectedVehicle.registration_number : ""}
        subtitle={inspectedVehicle ? `Vehicle Type: ${inspectedVehicle.vehicle_type}` : undefined}
        badge={<Badge variant="default">Vehicle</Badge>}
        metrics={
          inspectedVehicle
            ? [
                {
                  label: "Capacity",
                  value: `${Number(inspectedVehicle.capacity_kg).toLocaleString()} kg`,
                },
                { label: "Type", value: inspectedVehicle.vehicle_type },
              ]
            : []
        }
        sections={
          inspectedVehicle
            ? [
                {
                  title: "Trip Operations",
                  content: (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Assign this vehicle to delivery routes on the Trips page.
                      </p>
                      <Button asChild size="sm" className="w-full">
                        <Link to="/trips">
                          View Trip Schedule &rarr;
                        </Link>
                      </Button>
                    </div>
                  ),
                },
              ]
            : []
        }
      />

      {/* 9. Driver Detail Drawer */}
      <DetailDrawer
        open={Boolean(inspectedDriver)}
        onOpenChange={(open) => !open && setInspectedDriver(null)}
        title={inspectedDriver ? inspectedDriver.name : ""}
        subtitle="Commercial Fleet Driver"
        badge={<Badge variant="secondary">Driver</Badge>}
        metrics={
          inspectedDriver
            ? [{ label: "Status", value: "ACTIVE" }]
            : []
        }
        sections={
          inspectedDriver
            ? [
                {
                  title: "Driver Contact",
                  content: (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-border/40 py-1">
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="font-medium text-foreground">
                          {inspectedDriver.phone || "No phone recorded"}
                        </span>
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
