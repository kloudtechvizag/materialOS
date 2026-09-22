import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Phone, UserRound, UserRoundPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";
import type { Guardian, StudentGuardianLink } from "./types";

const RELATIONSHIP_LABEL: Record<string, string> = { father: "Father", mother: "Mother", guardian: "Guardian", other: "Other" };

export function GuardiansTab({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const [guardianForm, setGuardianForm] = useState({ full_name: "", phone: "", relationship_type: "guardian" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [portalAccessGuardianId, setPortalAccessGuardianId] = useState<string | null>(null);
  const [portalAccessForm, setPortalAccessForm] = useState({ email: "", password: "" });
  const [portalAccessCreatedFor, setPortalAccessCreatedFor] = useState<string | null>(null);

  const { data: links, isLoading, error } = useQuery({
    queryKey: ["student-guardians", studentId],
    queryFn: () => apiFetch<StudentGuardianLink[]>(`/students/${studentId}/guardians`),
  });
  const { data: guardians } = useQuery({ queryKey: ["guardians"], queryFn: () => apiFetch<Guardian[]>("/guardians") });
  const guardianById = new Map((guardians ?? []).map((g) => [g.id, g]));

  const addGuardian = useMutation({
    mutationFn: async () => {
      const guardian = await apiFetch<Guardian>("/guardians", { method: "POST", body: { full_name: guardianForm.full_name, phone: guardianForm.phone || null } });
      return apiFetch(`/students/${studentId}/guardians`, { method: "POST", body: { guardian_id: guardian.id, relationship_type: guardianForm.relationship_type, is_primary_contact: (links?.length ?? 0) === 0 } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-guardians", studentId] });
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
      setGuardianForm({ full_name: "", phone: "", relationship_type: "guardian" });
      setShowAddForm(false);
    },
  });

  const createPortalAccess = useMutation({
    mutationFn: (guardianId: string) =>
      apiFetch(`/guardians/${guardianId}/portal-access`, {
        method: "POST",
        body: { email: portalAccessForm.email, password: portalAccessForm.password, full_name: guardianById.get(guardianId)?.full_name ?? "" },
      }),
    onSuccess: (_data, guardianId) => {
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
      setPortalAccessCreatedFor(guardianById.get(guardianId)?.full_name ?? null);
      setPortalAccessGuardianId(null);
      setPortalAccessForm({ email: "", password: "" });
    },
  });

  if (isLoading) return <Skeleton className="h-48" />;
  if (error) return <p className="text-sm text-destructive">Could not load guardians.</p>;

  return (
    <div className="space-y-4">
      {portalAccessCreatedFor && (
        <p className="rounded-md border border-success/30 bg-success/10 p-2 text-sm text-success">
          Parent portal login created for {portalAccessCreatedFor}. Share the workspace name, email, and password with them.
        </p>
      )}

      {(!links || links.length === 0) && (
        <EmptyState icon={UserRound} title="No guardians linked" description="Add a parent or guardian so fee, attendance, and homework updates reach someone." actionLabel="Add guardian" onAction={() => setShowAddForm(true)} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {links?.map((l) => {
          const g = guardianById.get(l.guardian_id);
          if (!g) return null;
          return (
            <div key={l.id} className="space-y-2 rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{g.full_name}</p>
                  <p className="text-xs text-muted-foreground">{RELATIONSHIP_LABEL[l.relationship_type] ?? l.relationship_type}{l.is_primary_contact ? " · Primary Guardian" : ""}</p>
                </div>
                <Badge variant={g.user_id ? "success" : "outline"}>{g.user_id ? "Portal active" : "Portal inactive"}</Badge>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{g.phone ?? "Not recorded"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{g.email ?? "Not recorded"}</span></div>
                {g.occupation && <div className="flex justify-between"><span className="text-muted-foreground">Occupation</span><span>{g.occupation}</span></div>}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {g.phone && <a href={`tel:${g.phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline"><Phone className="h-3 w-3" /> Call</a>}
                {g.email && <a href={`mailto:${g.email}`} className="flex items-center gap-1 text-xs text-primary hover:underline"><Mail className="h-3 w-3" /> Email</a>}
                {!g.user_id && (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => setPortalAccessGuardianId(portalAccessGuardianId === l.guardian_id ? null : l.guardian_id)}>
                    Grant portal access
                  </button>
                )}
              </div>
              {portalAccessGuardianId === l.guardian_id && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                  <Input placeholder="Email" type="email" className="h-8 w-40" value={portalAccessForm.email} onChange={(e) => setPortalAccessForm((f) => ({ ...f, email: e.target.value }))} />
                  <Input placeholder="Password" type="password" className="h-8 w-36" value={portalAccessForm.password} onChange={(e) => setPortalAccessForm((f) => ({ ...f, password: e.target.value }))} />
                  <Button size="sm" className="h-8" onClick={() => createPortalAccess.mutate(l.guardian_id)} disabled={!portalAccessForm.email || !portalAccessForm.password || createPortalAccess.isPending}>
                    {createPortalAccess.isPending ? "Creating..." : "Create login"}
                  </Button>
                  {createPortalAccess.error instanceof ApiError && <p className="w-full text-xs text-destructive">{createPortalAccess.error.message}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {links && links.length > 0 && !showAddForm && (
        <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}><UserRoundPlus className="h-3.5 w-3.5" /> Add guardian</Button>
      )}
      {showAddForm && (
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-border p-3">
          <Input placeholder="Full name" value={guardianForm.full_name} onChange={(e) => setGuardianForm((f) => ({ ...f, full_name: e.target.value }))} />
          <Input placeholder="Phone" value={guardianForm.phone} onChange={(e) => setGuardianForm((f) => ({ ...f, phone: e.target.value }))} />
          <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={guardianForm.relationship_type} onChange={(e) => setGuardianForm((f) => ({ ...f, relationship_type: e.target.value }))}>
            <option value="father">Father</option>
            <option value="mother">Mother</option>
            <option value="guardian">Guardian</option>
            <option value="other">Other</option>
          </select>
          {addGuardian.error instanceof ApiError && <p className="col-span-3 text-xs text-destructive">{addGuardian.error.message}</p>}
          <div className="col-span-3 flex gap-2">
            <Button size="sm" onClick={() => addGuardian.mutate()} disabled={!guardianForm.full_name || addGuardian.isPending}>
              {addGuardian.isPending ? "Saving..." : "Save guardian"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
