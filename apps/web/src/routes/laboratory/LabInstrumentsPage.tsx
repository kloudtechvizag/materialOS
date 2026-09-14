import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Instrument {
  id: string;
  code: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  is_active: boolean;
}
interface ImportRowOutcome {
  row: number;
  status: string;
  message: string | null;
  sample_number: string;
  test_code: string;
  result_id: string | null;
}
interface ImportResponse {
  instrument_id: string;
  imported_count: number;
  error_count: number;
  rows: ImportRowOutcome[];
}

const EMPTY_FORM = { code: "", name: "", manufacturer: "", model: "" };

export function LabInstrumentsPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeInstrumentId, setActiveInstrumentId] = useState<string | null>(null);

  const { data: instruments, isLoading, error, refetch } = useQuery({
    queryKey: ["lab-instruments"],
    queryFn: () => apiFetch<Instrument[]>("/lab/instruments"),
  });

  const createInstrument = useMutation({
    mutationFn: () => apiFetch<Instrument>("/lab/instruments", { method: "POST", body: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-instruments"] });
      setAddOpen(false);
      setForm(EMPTY_FORM);
    },
  });

  const importResults = useMutation({
    mutationFn: ({ instrumentId, file }: { instrumentId: string; file: File }) => {
      const body = new FormData();
      body.append("file", file);
      return apiFetch<ImportResponse>(`/lab/instruments/${instrumentId}/import-results`, { method: "POST", body, isFormData: true });
    },
    onSuccess: (result) => setImportResult(result),
  });

  function triggerImport(instrumentId: string) {
    setActiveInstrumentId(instrumentId);
    setImportResult(null);
    fileInputRef.current?.click();
  }

  function handleFile(file: File | undefined) {
    if (!file || !activeInstrumentId) return;
    importResults.mutate({ instrumentId: activeInstrumentId, file });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Instruments</h1>
          <p className="text-sm text-muted-foreground">Import results from an instrument's CSV export -- sample_number, test_code, result_value.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>Add instrument</Button>
      </div>

      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {instruments && instruments.length === 0 && (
        <EmptyState icon={Cpu} title="No instruments yet" description="Add an instrument to start importing its results by CSV." actionLabel="Add instrument" onAction={() => setAddOpen(true)} />
      )}

      {instruments && instruments.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Manufacturer / model</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {instruments.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{i.code}</td>
                  <td className="px-4 py-2 font-medium">{i.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{[i.manufacturer, i.model].filter(Boolean).join(" · ") || "--"}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => triggerImport(i.id)} disabled={importResults.isPending && activeInstrumentId === i.id}>
                      {importResults.isPending && activeInstrumentId === i.id ? "Importing..." : "Import results CSV"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importResults.isError && <ErrorState error={importResults.error} />}

      {importResult && (
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2 text-sm font-medium">
            <span>Import result</span>
            <span className="text-xs font-normal text-muted-foreground">
              {importResult.imported_count} imported &middot; {importResult.error_count} error{importResult.error_count === 1 ? "" : "s"}
            </span>
          </div>
          <div className="divide-y divide-border">
            {importResult.rows.map((row) => (
              <div key={row.row} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <span className="font-mono text-xs text-muted-foreground">Row {row.row + 1}</span>{" "}
                  <span>{row.sample_number} &middot; {row.test_code}</span>
                  {row.message && <p className="text-xs text-destructive">{row.message}</p>}
                </div>
                <Badge variant={row.status === "imported" ? "success" : "destructive"}>{row.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add instrument</DialogTitle>
            <DialogDescription>A catalog entry for a physical instrument whose CSV result exports you'll import here.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="AU680" />
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Beckman AU680" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Manufacturer</Label>
                <Input value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
              </div>
            </div>
          </div>
          {createInstrument.isError && <ErrorState error={createInstrument.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createInstrument.mutate()} disabled={!form.code || !form.name || createInstrument.isPending}>
              {createInstrument.isPending ? "Saving..." : "Add instrument"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
