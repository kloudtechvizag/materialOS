import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Vehicle { id: string; registration_number: string; }
interface Driver { id: string; name: string; }
interface Branch { id: string; }
interface Trip { id: string; trip_date: string; status: string; vehicle_id: string; driver_id: string; deliveries: { id: string }[]; }

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success"> = {
  planned: "outline",
  started: "secondary",
  completed: "success",
};

export function TripsPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");

  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });
  const { data: vehicles } = useQuery({ queryKey: ["vehicles"], queryFn: () => apiFetch<Vehicle[]>("/vehicles") });
  const { data: drivers } = useQuery({ queryKey: ["drivers"], queryFn: () => apiFetch<Driver[]>("/drivers") });
  const { data: trips, isLoading, error, refetch } = useQuery({ queryKey: ["trips"], queryFn: () => apiFetch<Trip[]>("/trips") });

  const createTrip = useMutation({
    mutationFn: () =>
      apiFetch<Trip>("/trips", {
        method: "POST",
        body: { branch_id: branches?.[0]?.id, vehicle_id: vehicleId, driver_id: driverId, trip_date: new Date().toISOString().slice(0, 10) },
      }),
    onSuccess: (trip) => navigate(`/trips/${trip.id}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Trips</h1>
          <p className="text-sm text-muted-foreground">One vehicle, one driver, one or more deliveries for the day.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New trip"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New trip</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">Select vehicle</option>
                {vehicles?.map((v) => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
              </select>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                <option value="">Select driver</option>
                {drivers?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            {createTrip.isError && <ErrorState error={createTrip.error} />}
            <Button onClick={() => createTrip.mutate()} disabled={!vehicleId || !driverId || createTrip.isPending}>
              {createTrip.isPending ? "Creating..." : "Create trip"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {trips && trips.length === 0 && !showForm && (
        <EmptyState icon={Truck} title="No trips yet" description="Create a trip and assign today's deliveries to a vehicle and driver." actionLabel="New trip" onAction={() => setShowForm(true)} />
      )}

      {trips && trips.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {trips.map((t) => (
            <Card key={t.id} className="cursor-pointer transition-colors hover:bg-accent/50" onClick={() => navigate(`/trips/${t.id}`)}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t.trip_date}</span>
                  <Badge variant={STATUS_VARIANT[t.status] ?? "outline"}>{t.status}</Badge>
                </div>
                <p className="mt-1 text-sm">{t.deliveries.length} deliveries assigned</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
