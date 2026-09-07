import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Company {
  id: string;
}

interface ImportBatch {
  id: string;
  source_type: "tally_xml" | "busy_csv";
  status: string;
  file_name: string;
}

interface ValidationEntry {
  level: "error" | "warning";
  message: string;
}

interface ImportBatchRow {
  id: string;
  row_type: string;
  row_index: number;
  mapped_data: Record<string, string> | null;
  validation_errors: ValidationEntry[] | null;
  is_valid: boolean;
}

interface PreviewResponse {
  batch: ImportBatch;
  counts_by_row_type: Record<string, number>;
  invalid_row_count: number;
  sample_rows: ImportBatchRow[];
}

interface CommitResponse {
  customers_created: number;
  suppliers_created: number;
  items_created: number;
  opening_stock_lines: number;
}

const STEPS = ["Upload", "Map columns", "Validate", "Preview", "Commit"] as const;

export function ImportWizardPage() {
  const navigate = useNavigate();
  const { data: companies } = useQuery({ queryKey: ["companies"], queryFn: () => apiFetch<Company[]>("/companies") });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => apiFetch<{ id: string }[]>("/warehouses"),
  });

  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [csvColumns, setCsvColumns] = useState<string[] | null>(null);
  const [rowType, setRowType] = useState("customer");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const currentStepIndex = commitResult
    ? 4
    : preview
      ? 3
      : batch && (batch.status === "mapped" || batch.status === "validated")
        ? 2
        : batch && batch.source_type === "busy_csv" && batch.status === "format_detected"
          ? 1
          : 0;

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const companyId = companies?.[0]?.id;
      if (!companyId) throw new Error("No company found for this workspace yet.");
      const form = new FormData();
      form.append("company_id", companyId);
      form.append("file", file);
      return apiFetch<ImportBatch>("/imports/upload", { method: "POST", body: form, isFormData: true });
    },
    onSuccess: async (created) => {
      setBatch(created);
      if (created.source_type === "busy_csv") {
        const cols = await apiFetch<{ columns: string[]; guessed_mapping: Record<string, string> }>(
          `/imports/${created.id}/columns`
        );
        setCsvColumns(cols.columns);
        setMapping(cols.guessed_mapping);
      } else {
        await validateMutation.mutateAsync(created.id);
      }
    },
  });

  const mapMutation = useMutation({
    mutationFn: async () => {
      if (!batch) throw new Error("no batch");
      return apiFetch<ImportBatch>(`/imports/${batch.id}/map`, {
        method: "POST",
        body: { row_type: rowType, mapping },
      });
    },
    onSuccess: async (updated) => {
      setBatch(updated);
      await validateMutation.mutateAsync(updated.id);
    },
  });

  const validateMutation = useMutation({
    mutationFn: (batchId: string) => apiFetch<ImportBatch>(`/imports/${batchId}/validate`, { method: "POST" }),
    onSuccess: async (updated) => {
      setBatch(updated);
      const previewResult = await apiFetch<PreviewResponse>(`/imports/${updated.id}/preview`, { method: "POST" });
      setPreview(previewResult);
    },
  });

  const commitMutation = useMutation({
    mutationFn: () => {
      if (!batch) throw new Error("no batch");
      const warehouseId = warehouses?.[0]?.id;
      const query = warehouseId ? `?default_warehouse_id=${warehouseId}` : "";
      return apiFetch<CommitResponse>(`/imports/${batch.id}/commit${query}`, {
        method: "POST",
        idempotencyKey,
      });
    },
    onSuccess: (result) => setCommitResult(result),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New import</h1>
        <p className="text-sm text-muted-foreground">No import ever commits without a preview.</p>
      </div>

      <ol className="flex items-center gap-2">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                i < currentStepIndex
                  ? "bg-success text-success-foreground"
                  : i === currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {i < currentStepIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn("text-sm", i === currentStepIndex ? "font-medium" : "text-muted-foreground")}>{step}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </li>
        ))}
      </ol>

      {!batch && (
        <Card>
          <CardHeader>
            <CardTitle>Upload your export file</CardTitle>
            <CardDescription>A Tally XML masters export, or a Busy/Marg CSV export.</CardDescription>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="import-file"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center hover:bg-accent/50"
            >
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Click to choose a file</span>
              <span className="text-xs text-muted-foreground">.xml or .csv</span>
            </label>
            <input
              id="import-file"
              type="file"
              accept=".xml,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
              }}
            />
            {uploadMutation.isPending && <p className="mt-3 text-sm text-muted-foreground">Uploading and detecting format...</p>}
            {uploadMutation.isError && <ErrorState error={uploadMutation.error} onRetry={() => uploadMutation.reset()} />}
          </CardContent>
        </Card>
      )}

      {batch && csvColumns && batch.status === "format_detected" && (
        <Card>
          <CardHeader>
            <CardTitle>Map columns</CardTitle>
            <CardDescription>Tell us what this file contains and which column is which.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">This file contains</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={rowType}
                onChange={(e) => setRowType(e.target.value)}
              >
                <option value="customer">Customers</option>
                <option value="supplier">Suppliers</option>
                <option value="item">Items</option>
              </select>
            </div>

            {["name", "gstin", "phone", "opening_balance", "base_uom", "hsn_code", "gst_rate", "opening_qty", "opening_rate"].map(
              (field) => (
                <div key={field} className="grid grid-cols-2 items-center gap-3">
                  <label className="text-sm text-muted-foreground">{field}</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={mapping[field] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                  >
                    <option value="">— not in file —</option>
                    {csvColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              )
            )}

            <Button onClick={() => mapMutation.mutate()} disabled={mapMutation.isPending}>
              {mapMutation.isPending ? "Validating..." : "Continue"}
            </Button>
            {mapMutation.isError && <ErrorState error={mapMutation.error} />}
          </CardContent>
        </Card>
      )}

      {preview && !commitResult && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Review what will be created before anything is written.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(preview.counts_by_row_type).map(([type, count]) => (
                <Badge key={type} variant="secondary">
                  {count} {type}
                  {count !== 1 ? "s" : ""}
                </Badge>
              ))}
              {preview.invalid_row_count > 0 && (
                <Badge variant="destructive">{preview.invalid_row_count} rows need attention</Badge>
              )}
            </div>

            {preview.sample_rows.some((r) => r.validation_errors?.length) && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium">Flagged rows</p>
                {preview.sample_rows
                  .filter((r) => r.validation_errors?.length)
                  .map((r) => (
                    <div key={r.id} className="text-sm">
                      <span className="font-medium">{r.mapped_data?.name ?? `Row ${r.row_index}`}</span>
                      {r.validation_errors?.map((e, i) => (
                        <p key={i} className={cn("text-xs", e.level === "error" ? "text-destructive" : "text-muted-foreground")}>
                          {e.level === "error" ? "Error: " : "Warning: "}
                          {e.message}
                        </p>
                      ))}
                    </div>
                  ))}
              </div>
            )}

            <Button onClick={() => commitMutation.mutate()} disabled={commitMutation.isPending}>
              {commitMutation.isPending ? "Committing..." : "Commit import"}
            </Button>
            {commitMutation.isError && <ErrorState error={commitMutation.error} />}
          </CardContent>
        </Card>
      )}

      {commitResult && (
        <Card>
          <CardHeader>
            <CheckCircle2 className="h-6 w-6 text-success" />
            <CardTitle>Import committed</CardTitle>
            <CardDescription>
              {commitResult.customers_created} customers, {commitResult.suppliers_created} suppliers,{" "}
              {commitResult.items_created} items, and {commitResult.opening_stock_lines} opening stock lines created.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/imports")}>Done</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
