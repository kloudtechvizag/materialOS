import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Branch {
  id: string;
  name: string;
  code: string;
  gstin: string | null;
  is_active: boolean;
}

interface Company {
  id: string;
}

export function BranchesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const { data: companies } = useQuery({ queryKey: ["companies"], queryFn: () => apiFetch<Company[]>("/companies") });
  const { data: branches, isLoading, error, refetch } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiFetch<Branch[]>("/branches"),
  });

  const createBranch = useMutation({
    mutationFn: () =>
      apiFetch<Branch>("/branches", {
        method: "POST",
        body: { company_id: companies?.[0]?.id, name, code },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setShowForm(false);
      setName("");
      setCode("");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Branches</h1>
          <p className="text-sm text-muted-foreground">Every branch gets its own document numbering and GSTIN.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add branch"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New branch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="branch-name">Name</Label>
                <Input id="branch-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vijayawada" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="branch-code">Code</Label>
                <Input id="branch-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="VJA" />
              </div>
            </div>
            {createBranch.isError && <ErrorState error={createBranch.error} />}
            <Button onClick={() => createBranch.mutate()} disabled={!name || !code || createBranch.isPending}>
              {createBranch.isPending ? "Saving..." : "Save branch"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-32" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {branches && branches.length === 0 && !showForm && (
        <EmptyState
          icon={Building2}
          title="No additional branches yet"
          description="Every workspace starts with a Main Branch. Add more if this business operates from multiple locations."
          actionLabel="Add branch"
          onAction={() => setShowForm(true)}
        />
      )}

      {branches && branches.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {branches.map((b) => (
            <Card key={b.id}>
              <CardHeader>
                <CardTitle className="text-base">{b.name}</CardTitle>
                <p className="text-sm text-muted-foreground">Code: {b.code}</p>
                {b.gstin && <p className="text-sm text-muted-foreground">GSTIN: {b.gstin}</p>}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
