import { useQuery } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface ImportBatch {
  id: string;
  source_type: string;
  status: string;
  file_name: string;
  summary: { counts_by_row_type?: Record<string, number>; invalid_row_count?: number } | null;
}

const STATUS_VARIANT: Record<string, "secondary" | "success" | "destructive" | "outline"> = {
  uploaded: "outline",
  format_detected: "outline",
  mapped: "secondary",
  validated: "secondary",
  previewed: "secondary",
  committed: "success",
  failed: "destructive",
};

export function ImportsPage() {
  const { data: batches, isLoading, error, refetch } = useQuery({
    queryKey: ["import-batches"],
    queryFn: () => apiFetch<ImportBatch[]>("/imports"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Import from Tally / Busy</h1>
          <p className="text-sm text-muted-foreground">
            Upload → detect format → map columns → validate → preview → commit. Nothing is written until you
            confirm the preview.
          </p>
        </div>
        <Button asChild>
          <Link to="/imports/new">New import</Link>
        </Button>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {batches && batches.length === 0 && (
        <EmptyState
          icon={UploadCloud}
          title="No imports yet"
          description="Upload a Tally XML export or a Busy/Marg CSV export to bring in your customers, suppliers, items, and opening balances."
          actionLabel="Start your first import"
          onAction={() => (window.location.href = "/imports/new")}
        />
      )}

      {batches && batches.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">File</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Rows</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-4 py-2">{b.file_name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{b.source_type}</td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_VARIANT[b.status] ?? "outline"}>{b.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {b.summary?.counts_by_row_type
                      ? Object.entries(b.summary.counts_by_row_type)
                          .map(([type, count]) => `${count} ${type}`)
                          .join(", ")
                      : "—"}
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
