import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Worksheet {
  id: string;
  worksheet_number: string;
  test_definition_id: string;
  test_name: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}
interface TestDefinition { id: string; code: string; name: string }

const STATUS_VARIANT: Record<string, "success" | "secondary" | "outline"> = {
  open: "outline",
  in_progress: "secondary",
  completed: "success",
};

export function LabWorksheetsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [testDefinitionId, setTestDefinitionId] = useState("");

  const { data: worksheets, isLoading, error, refetch } = useQuery({
    queryKey: ["lab-worksheets"],
    queryFn: () => apiFetch<Worksheet[]>("/lab/worksheets"),
  });
  const { data: testDefs } = useQuery({ queryKey: ["lab-test-definitions"], queryFn: () => apiFetch<TestDefinition[]>("/lab/test-definitions") });

  const createWorksheet = useMutation({
    mutationFn: () => apiFetch<Worksheet>("/lab/worksheets", { method: "POST", body: { test_definition_id: testDefinitionId } }),
    onSuccess: (worksheet) => {
      queryClient.invalidateQueries({ queryKey: ["lab-worksheets"] });
      setAddOpen(false);
      setTestDefinitionId("");
      navigate(`/lab/worksheets/${worksheet.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Worksheets</h1>
          <p className="text-sm text-muted-foreground">Batch test orders for one test together, with QC scoped to the batch.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>New worksheet</Button>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {worksheets && worksheets.length === 0 && (
        <EmptyState icon={ClipboardList} title="No worksheets yet" description="Create a worksheet to batch-process test orders for one test." actionLabel="New worksheet" onAction={() => setAddOpen(true)} />
      )}

      {worksheets && worksheets.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Worksheet #</th>
                <th className="px-4 py-2 font-medium">Test</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {worksheets.map((w) => (
                <tr key={w.id} className="cursor-pointer border-t border-border hover:bg-accent/50" onClick={() => navigate(`/lab/worksheets/${w.id}`)}>
                  <td className="px-4 py-2 font-medium text-primary">{w.worksheet_number}</td>
                  <td className="px-4 py-2">{w.test_name}</td>
                  <td className="px-4 py-2"><Badge variant={STATUS_VARIANT[w.status] ?? "outline"}>{w.status.replace("_", " ")}</Badge></td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(w.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New worksheet</DialogTitle>
            <DialogDescription>Groups test orders for one test definition into a batch run.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Test</Label>
            <select
              className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={testDefinitionId}
              onChange={(e) => setTestDefinitionId(e.target.value)}
            >
              <option value="">Select test...</option>
              {(testDefs ?? []).map((t) => <option key={t.id} value={t.id}>{t.code} -- {t.name}</option>)}
            </select>
          </div>
          {createWorksheet.isError && <ErrorState error={createWorksheet.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createWorksheet.mutate()} disabled={!testDefinitionId || createWorksheet.isPending}>
              {createWorksheet.isPending ? "Creating..." : "Create worksheet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
