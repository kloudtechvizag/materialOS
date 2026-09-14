import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { platformFetch } from "@/lib/platformApi";

interface PlatformAdminRow {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_by_admin_id: string | null;
  created_at: string;
}

const EMPTY_FORM = { email: "", full_name: "", password: "", acting_admin_password: "" };

export function PlatformAdminsPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: admins, isLoading, error, refetch } = useQuery({
    queryKey: ["platform-admins"],
    queryFn: () => platformFetch<PlatformAdminRow[]>("/platform/admins"),
  });

  const adminsById = new Map((admins ?? []).map((a) => [a.id, a]));

  const createAdmin = useMutation({
    mutationFn: () => platformFetch<PlatformAdminRow>("/platform/admins", { method: "POST", body: form }),
    onSuccess: () => {
      setAddOpen(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Platform admins</h1>
          <p className="mt-1 text-sm text-white/60">Everyone who can sign in to this console, and who vouched for them.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>New admin</Button>
      </div>

      {isLoading && <Skeleton className="h-64 bg-white/10" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {admins && admins.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white text-foreground shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created by</th>
                <th className="px-4 py-3 font-medium">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {admins.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium">{a.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={a.is_active ? "success" : "outline"}>{a.is_active ? "active" : "inactive"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {a.created_by_admin_id ? adminsById.get(a.created_by_admin_id)?.full_name ?? "another admin" : "bootstrap script"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New platform admin</DialogTitle>
            <DialogDescription>
              Confirm it's really you by re-entering your own password -- not the new admin's.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>New admin's password</Label>
              <PasswordInput value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="space-y-1.5 border-t border-border pt-4">
              <Label>Your own password (to confirm it's you)</Label>
              <PasswordInput
                value={form.acting_admin_password}
                onChange={(e) => setForm((f) => ({ ...f, acting_admin_password: e.target.value }))}
              />
            </div>
          </div>
          {createAdmin.isError && <ErrorState error={createAdmin.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createAdmin.mutate()}
              disabled={!form.full_name || !form.email || !form.password || !form.acting_admin_password || createAdmin.isPending}
            >
              {createAdmin.isPending ? "Creating..." : "Create admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
