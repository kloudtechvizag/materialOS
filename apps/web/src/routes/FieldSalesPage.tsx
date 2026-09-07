import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Customer { id: string; name: string; }
interface Visit { id: string; customer_id: string; checked_in_at: string; purpose: string | null; notes: string | null; }

export function FieldSalesPage() {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [purpose, setPurpose] = useState("Routine visit");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => apiFetch<Customer[]>("/customers") });
  const { data: visits, isLoading, error, refetch } = useQuery({ queryKey: ["visits"], queryFn: () => apiFetch<Visit[]>("/visits") });

  function customerName(id: string) {
    return customers?.find((c) => c.id === id)?.name ?? id;
  }

  function captureLocation() {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setLocationError(err.message)
    );
  }

  const checkIn = useMutation({
    mutationFn: () =>
      apiFetch<Visit>("/visits", {
        method: "POST",
        body: { customer_id: customerId, purpose, notes, latitude: location?.lat, longitude: location?.lng },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      setCustomerId("");
      setNotes("");
      setLocation(null);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Field sales</h1>
        <p className="text-sm text-muted-foreground">Check in at a customer visit -- online mobile web for now (see ADR-005).</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Check in</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer</option>
              {customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Purpose</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option>Routine visit</option>
              <option>Collection follow-up</option>
              <option>New requirement</option>
              <option>Complaint resolution</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={captureLocation}>
            <MapPin className="h-4 w-4" /> {location ? "Location captured" : "Capture current location"}
          </Button>
          {locationError && <p className="text-xs text-destructive">{locationError}</p>}
          {checkIn.isError && <ErrorState error={checkIn.error} />}
          <Button onClick={() => checkIn.mutate()} disabled={!customerId || checkIn.isPending}>
            {checkIn.isPending ? "Checking in..." : "Check in"}
          </Button>
        </CardContent>
      </Card>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {visits && visits.length === 0 && <EmptyState icon={Users} title="No visits logged yet" description="Check in at your first customer visit above." />}
      {visits && visits.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recent visits</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {visits.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">{customerName(v.customer_id)}</p>
                  <p className="text-xs text-muted-foreground">{v.purpose} {v.notes ? `· ${v.notes}` : ""}</p>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(v.checked_in_at).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
