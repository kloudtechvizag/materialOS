import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Customer {
  id: string;
  name: string;
}

interface Project {
  id: string;
  customer_id: string;
  name: string;
  status: string;
  sites: { id: string; name: string; state: string }[];
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_id: "", name: "", site_name: "", site_state: "", site_city: "" });

  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => apiFetch<Customer[]>("/customers") });
  const { data: projects, isLoading, error, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<Project[]>("/projects"),
  });

  const createProject = useMutation({
    mutationFn: () =>
      apiFetch<Project>("/projects", {
        method: "POST",
        body: {
          customer_id: form.customer_id,
          name: form.name,
          sites: form.site_name
            ? [{ name: form.site_name, state: form.site_state, city: form.site_city }]
            : [],
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowForm(false);
      setForm({ customer_id: "", name: "", site_name: "", site_state: "", site_city: "" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">A commercial container for a customer's requirement across one or more delivery sites.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add project"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New project</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.customer_id} onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}>
                <option value="">Select a customer</option>
                {customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Project name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Green Valley Apartments" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Site name</Label>
                <Input value={form.site_name} onChange={(e) => setForm((f) => ({ ...f, site_name: e.target.value }))} placeholder="Vizag Site" />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={form.site_city} onChange={(e) => setForm((f) => ({ ...f, site_city: e.target.value }))} placeholder="Visakhapatnam" />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input value={form.site_state} onChange={(e) => setForm((f) => ({ ...f, site_state: e.target.value }))} placeholder="Andhra Pradesh" />
              </div>
            </div>
            {createProject.isError && <ErrorState error={createProject.error} />}
            <Button onClick={() => createProject.mutate()} disabled={!form.customer_id || !form.name || createProject.isPending}>
              {createProject.isPending ? "Saving..." : "Save project"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {projects && projects.length === 0 && !showForm && (
        <EmptyState icon={Building} title="No projects yet" description="Create a project to track requirement, orders, and profitability for a customer's site." actionLabel="Add project" onAction={() => setShowForm(true)} />
      )}

      {projects && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{p.sites.map((s) => s.name).join(", ") || "No sites yet"}</p>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
