import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface DeliveryChallan { id: string; number: string; status: string; }
interface Trip { id: string; status: string; trip_date: string; deliveries: DeliveryChallan[]; }

export function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const queryClient = useQueryClient();

  const { data: trip, isLoading, error, refetch } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => apiFetch<Trip>(`/trips/${tripId}`),
  });
  const { data: unassigned } = useQuery({
    queryKey: ["delivery-challans", "unassigned"],
    queryFn: () => apiFetch<DeliveryChallan[]>("/delivery-challans?unassigned=true"),
  });

  const assign = useMutation({
    mutationFn: (delivery_challan_id: string) =>
      apiFetch(`/trips/${tripId}/assign`, { method: "POST", body: { delivery_challan_id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["delivery-challans", "unassigned"] });
    },
  });

  const start = useMutation({
    mutationFn: () => apiFetch(`/trips/${tripId}/start`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip", tripId] }),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!trip) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Trip -- {trip.trip_date}</h1>
          <Badge variant={trip.status === "completed" ? "success" : "secondary"} className="mt-1">{trip.status}</Badge>
        </div>
        {trip.status === "planned" && trip.deliveries.length > 0 && (
          <Button onClick={() => start.mutate()} disabled={start.isPending}>{start.isPending ? "Starting..." : "Start trip"}</Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Assigned deliveries</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {trip.deliveries.length === 0 && <p className="text-sm text-muted-foreground">No deliveries assigned yet.</p>}
          {trip.deliveries.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <span className="font-medium">{d.number}</span>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{d.status}</Badge>
                {(d.status === "in_transit" || d.status === "dispatched") && (
                  <Link to={`/pod/${d.id}`} className="text-primary hover:underline">Capture POD</Link>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {trip.status === "planned" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Assign a delivery</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {unassigned && unassigned.length === 0 && (
              <p className="text-sm text-muted-foreground">No dispatched deliveries waiting for a trip.</p>
            )}
            {unassigned?.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <span>{d.number}</span>
                <Button size="sm" variant="outline" onClick={() => assign.mutate(d.id)} disabled={assign.isPending}>
                  Assign
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
