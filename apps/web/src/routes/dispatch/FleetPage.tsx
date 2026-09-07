import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Vehicle { id: string; registration_number: string; vehicle_type: string; capacity_kg: string; }
interface Driver { id: string; name: string; phone: string | null; }
interface Branch { id: string; }

export function FleetPage() {
  const queryClient = useQueryClient();
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });

  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ registration_number: "", vehicle_type: "", capacity_kg: "0" });
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: "", phone: "" });

  const { data: vehicles, isLoading: loadingVehicles, error: vehiclesError, refetch: refetchVehicles } = useQuery({
    queryKey: ["vehicles"], queryFn: () => apiFetch<Vehicle[]>("/vehicles"),
  });
  const { data: drivers, isLoading: loadingDrivers, error: driversError, refetch: refetchDrivers } = useQuery({
    queryKey: ["drivers"], queryFn: () => apiFetch<Driver[]>("/drivers"),
  });

  const createVehicle = useMutation({
    mutationFn: () =>
      apiFetch<Vehicle>("/vehicles", {
        method: "POST",
        body: { ...vehicleForm, capacity_kg: Number(vehicleForm.capacity_kg), branch_id: branches?.[0]?.id },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setShowVehicleForm(false);
      setVehicleForm({ registration_number: "", vehicle_type: "", capacity_kg: "0" });
    },
  });

  const createDriver = useMutation({
    mutationFn: () =>
      apiFetch<Driver>("/drivers", { method: "POST", body: { ...driverForm, branch_id: branches?.[0]?.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      setShowDriverForm(false);
      setDriverForm({ name: "", phone: "" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fleet</h1>
        <p className="text-sm text-muted-foreground">Vehicles and drivers get assigned to trips on the dispatch board.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Vehicles</h2>
            <Button size="sm" onClick={() => setShowVehicleForm((v) => !v)}>{showVehicleForm ? "Cancel" : "Add vehicle"}</Button>
          </div>

          {showVehicleForm && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="space-y-1.5">
                  <Label>Registration number</Label>
                  <Input value={vehicleForm.registration_number} onChange={(e) => setVehicleForm((f) => ({ ...f, registration_number: e.target.value }))} placeholder="AP31AB1234" />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Input value={vehicleForm.vehicle_type} onChange={(e) => setVehicleForm((f) => ({ ...f, vehicle_type: e.target.value }))} placeholder="6-wheeler" />
                </div>
                <div className="space-y-1.5">
                  <Label>Capacity (kg)</Label>
                  <Input type="number" value={vehicleForm.capacity_kg} onChange={(e) => setVehicleForm((f) => ({ ...f, capacity_kg: e.target.value }))} />
                </div>
                {createVehicle.isError && <ErrorState error={createVehicle.error} />}
                <Button size="sm" onClick={() => createVehicle.mutate()} disabled={!vehicleForm.registration_number || createVehicle.isPending}>
                  Save vehicle
                </Button>
              </CardContent>
            </Card>
          )}

          {loadingVehicles && <Skeleton className="h-24" />}
          {vehiclesError && <ErrorState error={vehiclesError} onRetry={() => refetchVehicles()} />}
          {vehicles && vehicles.length === 0 && !showVehicleForm && (
            <EmptyState icon={Truck} title="No vehicles yet" description="Add your first vehicle to assign it to trips." actionLabel="Add vehicle" onAction={() => setShowVehicleForm(true)} />
          )}
          {vehicles?.map((v) => (
            <Card key={v.id}><CardContent className="flex items-center justify-between p-4 text-sm">
              <span className="font-medium">{v.registration_number}</span>
              <span className="text-muted-foreground">{v.vehicle_type} · {v.capacity_kg} kg</span>
            </CardContent></Card>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Drivers</h2>
            <Button size="sm" onClick={() => setShowDriverForm((v) => !v)}>{showDriverForm ? "Cancel" : "Add driver"}</Button>
          </div>

          {showDriverForm && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={driverForm.name} onChange={(e) => setDriverForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={driverForm.phone} onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                {createDriver.isError && <ErrorState error={createDriver.error} />}
                <Button size="sm" onClick={() => createDriver.mutate()} disabled={!driverForm.name || createDriver.isPending}>
                  Save driver
                </Button>
              </CardContent>
            </Card>
          )}

          {loadingDrivers && <Skeleton className="h-24" />}
          {driversError && <ErrorState error={driversError} onRetry={() => refetchDrivers()} />}
          {drivers && drivers.length === 0 && !showDriverForm && (
            <EmptyState icon={UserIcon} title="No drivers yet" description="Add your first driver to assign them to trips." actionLabel="Add driver" onAction={() => setShowDriverForm(true)} />
          )}
          {drivers?.map((d) => (
            <Card key={d.id}><CardContent className="flex items-center justify-between p-4 text-sm">
              <span className="font-medium">{d.name}</span>
              <span className="text-muted-foreground">{d.phone}</span>
            </CardContent></Card>
          ))}
        </div>
      </div>
    </div>
  );
}
