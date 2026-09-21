import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentDrawer } from "@/components/entities/StudentDrawer";
import { apiFetch } from "@/lib/api";

interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  status: string;
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  active: "success", transferred: "secondary", withdrawn: "destructive", alumni: "outline", inactive: "outline",
};

const PAGE_SIZE = 20;

export function StudentsPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);

  const { data: students, isLoading, error, refetch } = useQuery({
    queryKey: ["students"],
    queryFn: () => apiFetch<Student[]>("/students"),
  });

  const pageCount = Math.max(1, Math.ceil((students?.length ?? 0) / PAGE_SIZE));
  const pageStudents = (students ?? []).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Student directory</h1>
          <p className="text-sm text-muted-foreground">{students?.length ?? 0} students.</p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>+ Admit student</Button>
      </div>

      <StudentDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {students && students.length === 0 && (
        <EmptyState icon={GraduationCap} title="No students yet" description="Admit your first student to start building the school's roster." actionLabel="Admit student" onAction={() => setDrawerOpen(true)} />
      )}

      {students && students.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="p-3">Admission no.</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Quick actions</th>
                </tr>
              </thead>
              <tbody>
                {pageStudents.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                    <td className="p-3 text-muted-foreground">{s.admission_number}</td>
                    <td className="p-3">
                      <Link to={`/students/${s.id}`} className="font-medium text-primary hover:underline">{s.first_name} {s.last_name}</Link>
                    </td>
                    <td className="p-3"><Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>{s.status}</Badge></td>
                    <td className="p-3">
                      <Link to={`/students/${s.id}`} className="text-xs font-medium text-primary hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">Page {page + 1} of {pageCount}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
