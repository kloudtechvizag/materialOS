import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api";

interface AcademicYear { id: string; is_current: boolean; }
interface SchoolClass { id: string; academic_year_id: string; name: string; }
interface Section { id: string; school_class_id: string; name: string; }
interface Vehicle { id: string; registration_number: string; }
interface Driver { id: string; name: string; }
interface Branch { id: string; }
interface Route { id: string; name: string; vehicle_id: string; driver_id: string; }
interface Stop { id: string; route_id: string; name: string; sequence: number; pickup_time: string; drop_time: string; }
interface RosterEntry { student_id: string; first_name: string; last_name: string; stop_name: string; }

/** Transport (spec sec18): reuses the existing core Vehicle/Driver
 * masters (models/fleet.py) directly -- a school bus route is a
 * persistent, recurring vehicle+driver+stop assignment layered on
 * top of infra this codebase already had. */
export function TransportPage() {
  const queryClient = useQueryClient();
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ registration_number: "", vehicle_type: "school bus" });
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: "", phone: "" });
  const [routeForm, setRouteForm] = useState({ name: "", vehicle_id: "", driver_id: "" });
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [stopForm, setStopForm] = useState({ name: "", sequence: "1", pickup_time: "07:30", drop_time: "15:30" });
  const [assignForm, setAssignForm] = useState({ school_class_id: "", section_id: "", student_id: "", stop_id: "" });

  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });
  const { data: vehicles } = useQuery({ queryKey: ["vehicles"], queryFn: () => apiFetch<Vehicle[]>("/vehicles") });
  const { data: drivers } = useQuery({ queryKey: ["drivers"], queryFn: () => apiFetch<Driver[]>("/drivers") });
  const { data: routes } = useQuery({ queryKey: ["transport-routes"], queryFn: () => apiFetch<Route[]>("/transport-routes") });
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const activeYearId = years?.find((y) => y.is_current)?.id ?? years?.[0]?.id ?? null;
  const { data: classes } = useQuery({
    queryKey: ["school-classes", activeYearId],
    queryFn: () => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${activeYearId}`),
    enabled: !!activeYearId,
  });
  const { data: sections } = useQuery({
    queryKey: ["sections", assignForm.school_class_id],
    queryFn: () => apiFetch<Section[]>(`/sections?school_class_id=${assignForm.school_class_id}`),
    enabled: !!assignForm.school_class_id,
  });
  const { data: sectionStudents } = useQuery({
    queryKey: ["students", assignForm.section_id],
    queryFn: () => apiFetch<{ id: string; first_name: string; last_name: string }[]>(`/students?section_id=${assignForm.section_id}`),
    enabled: !!assignForm.section_id,
  });

  const { data: stops, refetch: refetchStops } = useQuery({
    queryKey: ["route-stops", activeRouteId],
    queryFn: () => apiFetch<Stop[]>(`/transport-routes/${activeRouteId}/stops`),
    enabled: !!activeRouteId,
  });
  const { data: roster, refetch: refetchRoster } = useQuery({
    queryKey: ["route-roster", activeRouteId],
    queryFn: () => apiFetch<RosterEntry[]>(`/transport-routes/${activeRouteId}/roster`),
    enabled: !!activeRouteId,
  });

  const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v.registration_number]));
  const driverById = new Map((drivers ?? []).map((d) => [d.id, d.name]));
  const activeRoute = routes?.find((r) => r.id === activeRouteId) ?? null;

  const addVehicle = useMutation({
    mutationFn: () => apiFetch("/vehicles", { method: "POST", body: { branch_id: branches?.[0]?.id, ...vehicleForm } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vehicles"] }); setShowAddVehicle(false); setVehicleForm({ registration_number: "", vehicle_type: "school bus" }); },
  });

  const addDriver = useMutation({
    mutationFn: () => apiFetch("/drivers", { method: "POST", body: { branch_id: branches?.[0]?.id, name: driverForm.name, phone: driverForm.phone || null } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["drivers"] }); setShowAddDriver(false); setDriverForm({ name: "", phone: "" }); },
  });

  const addRoute = useMutation({
    mutationFn: () => apiFetch("/transport-routes", { method: "POST", body: routeForm }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["transport-routes"] }); setRouteForm({ name: "", vehicle_id: "", driver_id: "" }); },
  });

  const addStop = useMutation({
    mutationFn: () => apiFetch(`/transport-routes/${activeRouteId}/stops`, { method: "POST", body: { ...stopForm, sequence: Number(stopForm.sequence), pickup_time: `${stopForm.pickup_time}:00`, drop_time: `${stopForm.drop_time}:00` } }),
    onSuccess: () => { refetchStops(); setStopForm({ name: "", sequence: String((stops?.length ?? 0) + 2), pickup_time: "07:30", drop_time: "15:30" }); },
  });

  const assignStudent = useMutation({
    mutationFn: () => apiFetch(`/students/${assignForm.student_id}/transport-assignment`, { method: "POST", body: { academic_year_id: activeYearId, route_id: activeRouteId, stop_id: assignForm.stop_id } }),
    onSuccess: () => { refetchRoster(); setAssignForm((f) => ({ ...f, student_id: "", stop_id: "" })); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Transport</h1>
        <p className="text-sm text-muted-foreground">Bus routes, stops, and student assignments.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Vehicles</h2>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowAddVehicle((v) => !v)}>{showAddVehicle ? "Cancel" : "Add vehicle"}</button>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {vehicles?.map((v) => <li key={v.id}>{v.registration_number}</li>)}
            {vehicles?.length === 0 && <li>No vehicles yet.</li>}
          </ul>
          {showAddVehicle && (
            <div className="flex gap-2 pt-1">
              <Input placeholder="Registration number" value={vehicleForm.registration_number} onChange={(e) => setVehicleForm((f) => ({ ...f, registration_number: e.target.value }))} />
              <Button size="sm" onClick={() => addVehicle.mutate()} disabled={!vehicleForm.registration_number || addVehicle.isPending}>Add</Button>
            </div>
          )}
          {addVehicle.error instanceof ApiError && <p className="text-xs text-destructive">{addVehicle.error.message}</p>}
        </div>

        <div className="space-y-2 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Drivers</h2>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowAddDriver((v) => !v)}>{showAddDriver ? "Cancel" : "Add driver"}</button>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {drivers?.map((d) => <li key={d.id}>{d.name}</li>)}
            {drivers?.length === 0 && <li>No drivers yet.</li>}
          </ul>
          {showAddDriver && (
            <div className="flex gap-2 pt-1">
              <Input placeholder="Name" value={driverForm.name} onChange={(e) => setDriverForm((f) => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Phone" value={driverForm.phone} onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))} />
              <Button size="sm" onClick={() => addDriver.mutate()} disabled={!driverForm.name || addDriver.isPending}>Add</Button>
            </div>
          )}
          {addDriver.error instanceof ApiError && <p className="text-xs text-destructive">{addDriver.error.message}</p>}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">Routes</h2>
        <div className="space-y-1">
          {routes?.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveRouteId(r.id)}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${activeRouteId === r.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"}`}
            >
              <span>{r.name}</span>
              <span className="text-xs text-muted-foreground">{vehicleById.get(r.vehicle_id)} · {driverById.get(r.driver_id)}</span>
            </button>
          ))}
          {routes?.length === 0 && <p className="text-sm text-muted-foreground">No routes yet.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Route name" value={routeForm.name} onChange={(e) => setRouteForm((f) => ({ ...f, name: e.target.value }))} className="w-48" />
          <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={routeForm.vehicle_id} onChange={(e) => setRouteForm((f) => ({ ...f, vehicle_id: e.target.value }))}>
            <option value="">Vehicle...</option>
            {vehicles?.map((v) => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
          </select>
          <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={routeForm.driver_id} onChange={(e) => setRouteForm((f) => ({ ...f, driver_id: e.target.value }))}>
            <option value="">Driver...</option>
            {drivers?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button size="sm" onClick={() => addRoute.mutate()} disabled={!routeForm.name || !routeForm.vehicle_id || !routeForm.driver_id || addRoute.isPending}>Add route</Button>
        </div>
        {addRoute.error instanceof ApiError && <p className="text-sm text-destructive">{addRoute.error.message}</p>}
      </div>

      {activeRoute && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-medium">Stops — {activeRoute.name}</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {stops?.map((s) => <li key={s.id}>{s.sequence}. {s.name} — pickup {s.pickup_time.slice(0, 5)}, drop {s.drop_time.slice(0, 5)}</li>)}
              {stops?.length === 0 && <li>No stops yet.</li>}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Input placeholder="Stop name" value={stopForm.name} onChange={(e) => setStopForm((f) => ({ ...f, name: e.target.value }))} className="w-32" />
              <Input type="number" placeholder="#" value={stopForm.sequence} onChange={(e) => setStopForm((f) => ({ ...f, sequence: e.target.value }))} className="w-16" />
              <input type="time" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={stopForm.pickup_time} onChange={(e) => setStopForm((f) => ({ ...f, pickup_time: e.target.value }))} />
              <input type="time" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={stopForm.drop_time} onChange={(e) => setStopForm((f) => ({ ...f, drop_time: e.target.value }))} />
              <Button size="sm" onClick={() => addStop.mutate()} disabled={!stopForm.name || addStop.isPending}>Add</Button>
            </div>
            {addStop.error instanceof ApiError && <p className="text-xs text-destructive">{addStop.error.message}</p>}
          </div>

          <div className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-medium">Roster</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {roster?.map((r) => <li key={r.student_id}>{r.first_name} {r.last_name} — {r.stop_name}</li>)}
              {roster?.length === 0 && <li>No students assigned yet.</li>}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={assignForm.school_class_id} onChange={(e) => setAssignForm((f) => ({ ...f, school_class_id: e.target.value, section_id: "", student_id: "" }))}>
                <option value="">Class...</option>
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={assignForm.section_id} onChange={(e) => setAssignForm((f) => ({ ...f, section_id: e.target.value, student_id: "" }))} disabled={!assignForm.school_class_id}>
                <option value="">Section...</option>
                {sections?.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
              </select>
              <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={assignForm.student_id} onChange={(e) => setAssignForm((f) => ({ ...f, student_id: e.target.value }))} disabled={!assignForm.section_id}>
                <option value="">Student...</option>
                {sectionStudents?.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
              <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={assignForm.stop_id} onChange={(e) => setAssignForm((f) => ({ ...f, stop_id: e.target.value }))}>
                <option value="">Stop...</option>
                {stops?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Button size="sm" onClick={() => assignStudent.mutate()} disabled={!assignForm.student_id || !assignForm.stop_id || assignStudent.isPending}>Assign</Button>
            </div>
            {assignStudent.error instanceof ApiError && <p className="text-xs text-destructive">{assignStudent.error.message}</p>}
          </div>
        </div>
      )}

      {routes?.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <Bus className="h-4 w-4" />
          <span>Start by adding a vehicle and driver, then create a route.</span>
        </div>
      )}
    </div>
  );
}
