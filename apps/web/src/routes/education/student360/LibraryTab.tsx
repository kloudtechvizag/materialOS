import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { LibraryIssue } from "./types";

export function LibraryTab({ studentId }: { studentId: string }) {
  const { data: history, isLoading, error } = useQuery({
    queryKey: ["student-library", studentId],
    queryFn: () => apiFetch<LibraryIssue[]>(`/students/${studentId}/library`),
  });

  if (isLoading) return <Skeleton className="h-40" />;
  if (error) return <p className="text-sm text-destructive">Could not load library history.</p>;
  if (!history || history.length === 0) {
    return <EmptyState icon={BookOpen} title="No books issued yet" description="Books this student borrows from the library will show up here." />;
  }

  return (
    <div className="space-y-2">
      {history.map((i) => (
        <div key={i.id} className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="font-medium">{i.book_title} <span className="text-xs text-muted-foreground">({i.accession_number})</span></p>
            <p className="text-xs text-muted-foreground">
              Issued {i.issued_date} · Due {i.due_date}{i.returned_date ? ` · Returned ${i.returned_date}` : ""}
              {Number(i.fine_amount) > 0 ? ` · Fine ₹${i.fine_amount}` : ""}
            </p>
          </div>
          <Badge variant={i.status === "returned" ? "success" : i.status === "lost" ? "destructive" : i.is_overdue ? "warning" : "outline"}>
            {i.status === "issued" && i.is_overdue ? "Overdue" : i.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
