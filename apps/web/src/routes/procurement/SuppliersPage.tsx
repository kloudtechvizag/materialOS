import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Factory } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Supplier { id: string; name: string; gstin: string | null; billing_state: string | null; }

export function SuppliersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", gstin: "", billing_state: "" });

  const { data: suppliers, isLoading, error, refetch } = useQuery({
    queryKey: ["suppliers"], queryFn: () => apiFetch<Supplier[]>("/suppliers"),
  });

  const createSupplier = useMutation({
    mutationFn: () => apiFetch<Supplier>("/suppliers", { method: "POST", body: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setShowForm(false);
      setForm({ name: "", gstin: "", billing_state: "" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Billing state drives CGST+SGST vs IGST on purchase bills.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add supplier"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New supplier</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="UltraTech Cement Distributors" />
              </div>
              <div className="space-y-1.5">
                <Label>GSTIN</Label>
                <Input value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Billing state</Label>
                <Input value={form.billing_state} onChange={(e) => setForm((f) => ({ ...f, billing_state: e.target.value }))} placeholder="Andhra Pradesh" />
              </div>
            </div>
            {createSupplier.isError && <ErrorState error={createSupplier.error} />}
            <Button onClick={() => createSupplier.mutate()} disabled={!form.name || createSupplier.isPending}>
              {createSupplier.isPending ? "Saving..." : "Save supplier"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {suppliers && suppliers.length === 0 && !showForm && (
        <EmptyState icon={Factory} title="No suppliers yet" description="Add your first supplier, or import them from Tally/Busy." actionLabel="Add supplier" onAction={() => setShowForm(true)} />
      )}

      {suppliers && suppliers.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">State</th><th className="px-4 py-2 font-medium"></th></tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{s.billing_state ?? "—"}</td>
                  <td className="px-4 py-2 text-right"><Link to={`/suppliers/${s.id}`} className="text-sm text-primary hover:underline">View 360</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
