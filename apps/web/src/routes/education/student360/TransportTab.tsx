import { useQuery } from "@tanstack/react-query";
import { Bus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { StudentTransport } from "./types";

export function TransportTab({ studentId }: { studentId: string }) {
  const { data: transport, isLoading, error } = useQuery({
    queryKey: ["student-transport", studentId],
    queryFn: () => apiFetch<StudentTransport | null>(`/students/${studentId}/transport`),
  });

  if (isLoading) return <Skeleton className="h-40" />;
  if (error) return <p className="text-sm text-destructive">Could not load transport.</p>;
  if (!transport) {
    return <EmptyState icon={Bus} title="No transport assigned" description="This student is not currently assigned to a school transport route." />;
  }

  return (
    <div className="max-w-md space-y-2 rounded-lg border border-border p-4 text-sm">
      <Row label="Route" value={transport.route_name} />
      <Row label="Pickup stop" value={transport.stop_name} />
      <Row label="Pickup time" value={transport.pickup_time.slice(0, 5)} />
      <Row label="Drop time" value={transport.drop_time.slice(0, 5)} />
      <Row label="Vehicle" value={transport.vehicle_registration_number} />
      <Row label="Driver" value={transport.driver_name} />
      {transport.driver_phone && <Row label="Driver contact" value={transport.driver_phone} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
