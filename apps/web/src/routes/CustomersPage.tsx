import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface Customer {
  id: string;
  name: string;
  gstin: string | null;
  phone: string | null;
  billing_state: string | null;
  credit_limit: string;
}

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", billing_state: "", credit_limit: "0", credit_days: "30" });

  const { data: customers, isLoading, error, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiFetch<Customer[]>("/customers"),
  });

  const createCustomer = useMutation({
    mutationFn: () =>
      apiFetch<Customer>("/customers", {
        method: "POST",
        body: { ...form, credit_limit: Number(form.credit_limit), credit_days: Number(form.credit_days) },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setShowForm(false);
      setForm({ name: "", phone: "", billing_state: "", credit_limit: "0", credit_days: "30" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">Credit limit here drives the automatic credit check on every order.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add customer"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New customer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ABC Constructions" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Billing state</Label>
                <Input value={form.billing_state} onChange={(e) => setForm((f) => ({ ...f, billing_state: e.target.value }))} placeholder="Andhra Pradesh" />
              </div>
              <div className="space-y-1.5">
                <Label>Credit limit (₹)</Label>
                <Input type="number" value={form.credit_limit} onChange={(e) => setForm((f) => ({ ...f, credit_limit: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Credit days</Label>
                <Input type="number" value={form.credit_days} onChange={(e) => setForm((f) => ({ ...f, credit_days: e.target.value }))} />
              </div>
            </div>
            {createCustomer.isError && <ErrorState error={createCustomer.error} />}
            <Button onClick={() => createCustomer.mutate()} disabled={!form.name || createCustomer.isPending}>
              {createCustomer.isPending ? "Saving..." : "Save customer"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {customers && customers.length === 0 && !showForm && (
        <EmptyState icon={Users} title="No customers yet" description="Add your first customer, or import them from Tally/Busy." actionLabel="Add customer" onAction={() => setShowForm(true)} />
      )}

      {customers && customers.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">State</th>
                <th className="px-4 py-2 font-medium">Credit limit</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.billing_state ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatINR(c.credit_limit)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/customers/${c.id}`} className="text-sm text-primary hover:underline">
                      View 360
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
