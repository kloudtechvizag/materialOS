import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bed } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api";

interface Employee { id: string; first_name: string; last_name: string; }
interface Hostel { id: string; name: string; hostel_type: string; warden_id: string | null; }
interface Room { id: string; hostel_id: string; room_number: string; floor: string | null; capacity: number; }
interface Occupant { student_id: string; first_name: string; last_name: string; bed_number: number; }
interface AcademicYear { id: string; is_current: boolean; }
interface SchoolClass { id: string; academic_year_id: string; name: string; }
interface Section { id: string; school_class_id: string; name: string; }
interface Student { id: string; first_name: string; last_name: string; }

const HOSTEL_TYPE_LABELS: Record<string, string> = { boys: "Boys", girls: "Girls", co_ed: "Co-ed" };

/** Hostel (spec sec19): buildings, rooms, and per-year bed
 * allocation. Wardens reuse the existing core Employee model. */
export function HostelPage() {
  const queryClient = useQueryClient();
  const [showAddHostel, setShowAddHostel] = useState(false);
  const [hostelForm, setHostelForm] = useState({ name: "", hostel_type: "co_ed", warden_id: "" });
  const [activeHostelId, setActiveHostelId] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState({ room_number: "", floor: "", capacity: "2" });
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [allocateForm, setAllocateForm] = useState({ school_class_id: "", section_id: "", student_id: "", bed_number: "1" });

  const { data: hostels } = useQuery({ queryKey: ["hostels"], queryFn: () => apiFetch<Hostel[]>("/hostels") });
  const { data: employees } = useQuery({ queryKey: ["employees-for-hostel"], queryFn: () => apiFetch<Employee[]>("/employees") });
  const { data: rooms, refetch: refetchRooms } = useQuery({
    queryKey: ["hostel-rooms", activeHostelId],
    queryFn: () => apiFetch<Room[]>(`/hostels/${activeHostelId}/rooms`),
    enabled: !!activeHostelId,
  });
  const { data: occupancy, refetch: refetchOccupancy } = useQuery({
    queryKey: ["hostel-room-occupancy", activeRoomId],
    queryFn: () => apiFetch<{ occupants: Occupant[] }>(`/hostel-rooms/${activeRoomId}/occupancy`),
    enabled: !!activeRoomId,
  });
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const activeYearId = years?.find((y) => y.is_current)?.id ?? years?.[0]?.id ?? null;
  const { data: classes } = useQuery({
    queryKey: ["school-classes", activeYearId],
    queryFn: () => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${activeYearId}`),
    enabled: !!activeYearId,
  });
  const { data: sections } = useQuery({
    queryKey: ["sections", allocateForm.school_class_id],
    queryFn: () => apiFetch<Section[]>(`/sections?school_class_id=${allocateForm.school_class_id}`),
    enabled: !!allocateForm.school_class_id,
  });
  const { data: sectionStudents } = useQuery({
    queryKey: ["students", allocateForm.section_id],
    queryFn: () => apiFetch<Student[]>(`/students?section_id=${allocateForm.section_id}`),
    enabled: !!allocateForm.section_id,
  });

  const employeeById = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));
  const activeRoom = rooms?.find((r) => r.id === activeRoomId) ?? null;

  const addHostel = useMutation({
    mutationFn: () => apiFetch("/hostels", { method: "POST", body: { ...hostelForm, warden_id: hostelForm.warden_id || null } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["hostels"] }); setShowAddHostel(false); setHostelForm({ name: "", hostel_type: "co_ed", warden_id: "" }); },
  });

  const addRoom = useMutation({
    mutationFn: () => apiFetch(`/hostels/${activeHostelId}/rooms`, { method: "POST", body: { ...roomForm, floor: roomForm.floor || null, capacity: Number(roomForm.capacity) } }),
    onSuccess: () => { refetchRooms(); setRoomForm({ room_number: "", floor: "", capacity: "2" }); },
  });

  const allocate = useMutation({
    mutationFn: () =>
      apiFetch(`/students/${allocateForm.student_id}/hostel-allocation`, {
        method: "POST",
        body: { academic_year_id: activeYearId, room_id: activeRoomId, bed_number: Number(allocateForm.bed_number) },
      }),
    onSuccess: () => { refetchOccupancy(); setAllocateForm((f) => ({ ...f, student_id: "" })); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hostel</h1>
          <p className="text-sm text-muted-foreground">Buildings, rooms, and bed allocation.</p>
        </div>
        <Button size="sm" onClick={() => setShowAddHostel((v) => !v)}>{showAddHostel ? "Cancel" : "New hostel"}</Button>
      </div>

      {showAddHostel && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-4">
          <Input placeholder="Name" value={hostelForm.name} onChange={(e) => setHostelForm((f) => ({ ...f, name: e.target.value }))} className="w-56" />
          <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={hostelForm.hostel_type} onChange={(e) => setHostelForm((f) => ({ ...f, hostel_type: e.target.value }))}>
            <option value="co_ed">Co-ed</option>
            <option value="boys">Boys</option>
            <option value="girls">Girls</option>
          </select>
          <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={hostelForm.warden_id} onChange={(e) => setHostelForm((f) => ({ ...f, warden_id: e.target.value }))}>
            <option value="">Warden (optional)...</option>
            {employees?.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </select>
          <Button size="sm" onClick={() => addHostel.mutate()} disabled={!hostelForm.name || addHostel.isPending}>Add</Button>
          {addHostel.error instanceof ApiError && <p className="w-full text-xs text-destructive">{addHostel.error.message}</p>}
        </div>
      )}

      <div className="space-y-1">
        {hostels?.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => { setActiveHostelId(h.id); setActiveRoomId(null); }}
            className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${activeHostelId === h.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"}`}
          >
            <span>{h.name}</span>
            <span className="text-xs text-muted-foreground">{HOSTEL_TYPE_LABELS[h.hostel_type]}{h.warden_id ? ` · Warden: ${employeeById.get(h.warden_id) ?? "-"}` : ""}</span>
          </button>
        ))}
        {hostels?.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            <Bed className="h-4 w-4" />
            <span>No hostels yet.</span>
          </div>
        )}
      </div>

      {activeHostelId && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-medium">Rooms</h2>
            <div className="space-y-1">
              {rooms?.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveRoomId(r.id)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${activeRoomId === r.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"}`}
                >
                  <span>{r.room_number}{r.floor ? ` (Floor ${r.floor})` : ""}</span>
                  <span className="text-xs text-muted-foreground">Capacity {r.capacity}</span>
                </button>
              ))}
              {rooms?.length === 0 && <p className="text-sm text-muted-foreground">No rooms yet.</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input placeholder="Room number" value={roomForm.room_number} onChange={(e) => setRoomForm((f) => ({ ...f, room_number: e.target.value }))} className="w-32" />
              <Input placeholder="Floor" value={roomForm.floor} onChange={(e) => setRoomForm((f) => ({ ...f, floor: e.target.value }))} className="w-24" />
              <Input type="number" placeholder="Capacity" value={roomForm.capacity} onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))} className="w-24" />
              <Button size="sm" onClick={() => addRoom.mutate()} disabled={!roomForm.room_number || addRoom.isPending}>Add room</Button>
            </div>
            {addRoom.error instanceof ApiError && <p className="text-xs text-destructive">{addRoom.error.message}</p>}
          </div>

          {activeRoom && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium">Occupancy — {activeRoom.room_number}</h2>
              <ul className="space-y-1 text-sm">
                {occupancy?.occupants.map((o) => (
                  <li key={o.student_id} className="flex items-center justify-between">
                    <span>{o.first_name} {o.last_name}</span>
                    <Badge variant="outline">Bed {o.bed_number}</Badge>
                  </li>
                ))}
                {occupancy?.occupants.length === 0 && <li className="text-muted-foreground">No students allocated yet.</li>}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={allocateForm.school_class_id} onChange={(e) => setAllocateForm((f) => ({ ...f, school_class_id: e.target.value, section_id: "", student_id: "" }))}>
                  <option value="">Class...</option>
                  {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={allocateForm.section_id} onChange={(e) => setAllocateForm((f) => ({ ...f, section_id: e.target.value, student_id: "" }))} disabled={!allocateForm.school_class_id}>
                  <option value="">Section...</option>
                  {sections?.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
                </select>
                <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={allocateForm.student_id} onChange={(e) => setAllocateForm((f) => ({ ...f, student_id: e.target.value }))} disabled={!allocateForm.section_id}>
                  <option value="">Student...</option>
                  {sectionStudents?.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
                <Input type="number" placeholder="Bed #" value={allocateForm.bed_number} onChange={(e) => setAllocateForm((f) => ({ ...f, bed_number: e.target.value }))} className="w-20" />
                <Button size="sm" onClick={() => allocate.mutate()} disabled={!allocateForm.student_id || allocate.isPending}>Allocate</Button>
              </div>
              {allocate.error instanceof ApiError && <p className="text-xs text-destructive">{allocate.error.message}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
