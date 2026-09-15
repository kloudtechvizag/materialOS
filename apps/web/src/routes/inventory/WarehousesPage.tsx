import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Warehouse as WarehouseIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Warehouse {
  id: string;
  branch_id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface Branch {
  id: string;
  name: string;
}

/** Multi-warehouse godown master (models/tenant.py's Warehouse). The
 * entity itself is core, cross-profile infrastructure -- every tenant
 * already has at least one warehouse feeding purchase-order/POS/stock-
 * count dropdowns regardless of industry. This page (and its nav entry,
 * gated by IndustryProfile.enabled_modules "warehouse") is the opt-in
 * *management* UI for tenants who actually run more than one location --
 * see lib/navigation.ts's Inventory & Trading section. */
export function WarehousesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [branchId, setBranchId] = useState("");

  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });
  const { data: warehouses, isLoading, error, refetch } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => apiFetch<Warehouse[]>("/warehouses"),
  });

  const branchById = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const createWarehouse = useMutation({
    mutationFn: () => apiFetch<Warehouse>("/warehouses", { method: "POST", body: { branch_id: branchId, name, code } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      setShowForm(false);
      setName("");
      setCode("");
      setBranchId("");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Warehouses</h1>
          <p className="text-sm text-muted-foreground">Godowns and stock locations across your branches.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add warehouse"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New warehouse</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="wh-name">Name</Label>
                <Input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Main godown" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-code">Code</Label>
                <Input id="wh-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="WH1" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-branch">Branch</Label>
                <select
                  id="wh-branch"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                >
                  <option value="">Select branch</option>
                  {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            {createWarehouse.isError && <ErrorState error={createWarehouse.error} />}
            <Button onClick={() => createWarehouse.mutate()} disabled={!name || !code || !branchId || createWarehouse.isPending}>
              {createWarehouse.isPending ? "Saving..." : "Save warehouse"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-32" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {warehouses && warehouses.length === 0 && !showForm && (
        <EmptyState
          icon={WarehouseIcon}
          title="No warehouses yet"
          description="Add a warehouse for each godown or stock location you operate."
          actionLabel="Add warehouse"
          onAction={() => setShowForm(true)}
        />
      )}

      {warehouses && warehouses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => (
            <Card key={w.id}>
              <CardHeader>
                <CardTitle className="text-base">{w.name}</CardTitle>
                <p className="text-sm text-muted-foreground">Code: {w.code}</p>
                <p className="text-sm text-muted-foreground">Branch: {branchById.get(w.branch_id) ?? "-"}</p>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
