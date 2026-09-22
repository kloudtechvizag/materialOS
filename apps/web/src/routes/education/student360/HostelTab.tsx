import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { StudentHostel } from "./types";

export function HostelTab({ studentId }: { studentId: string }) {
  const { data: hostel, isLoading, error } = useQuery({
    queryKey: ["student-hostel", studentId],
    queryFn: () => apiFetch<StudentHostel | null>(`/students/${studentId}/hostel`),
  });

  if (isLoading) return <Skeleton className="h-40" />;
  if (error) return <p className="text-sm text-destructive">Could not load hostel allocation.</p>;
  if (!hostel) {
    return <EmptyState icon={Building2} title="Not allocated to hostel accommodation" description="This student is currently a day scholar with no hostel room assigned." />;
  }

  return (
    <div className="max-w-md space-y-2 rounded-lg border border-border p-4 text-sm">
      <Row label="Hostel" value={hostel.hostel_name} />
      <Row label="Room" value={hostel.room_number} />
      <Row label="Bed" value={String(hostel.bed_number)} />
      {hostel.warden_name && <Row label="Warden" value={hostel.warden_name} />}
      {hostel.warden_phone && <Row label="Warden contact" value={hostel.warden_phone} />}
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
