import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileCheck2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api";

interface AcademicYear { id: string; name: string; is_current: boolean; }
interface Examination { id: string; academic_year_id: string; name: string; start_date: string; end_date: string; is_locked: boolean; }

/** Examinations & Report Cards (spec sec13/14): create a named exam
 * for an academic year, then configure per-class subjects and enter
 * marks on its own detail page. */
export function ExaminationsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ academic_year_id: "", name: "", start_date: "", end_date: "" });

  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const { data: examinations, isLoading } = useQuery({ queryKey: ["examinations"], queryFn: () => apiFetch<Examination[]>("/examinations") });
  const yearById = new Map((years ?? []).map((y) => [y.id, y.name]));

  const create = useMutation({
    mutationFn: () => apiFetch("/examinations", { method: "POST", body: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examinations"] });
      setShowCreate(false);
      setForm({ academic_year_id: "", name: "", start_date: "", end_date: "" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Examinations</h1>
          <p className="text-sm text-muted-foreground">Exam terms, subject-wise marks, and report cards.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>{showCreate ? "Cancel" : "New examination"}</Button>
      </div>

      {showCreate && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.academic_year_id} onChange={(e) => setForm((f) => ({ ...f, academic_year_id: e.target.value }))}>
              <option value="">Academic year...</option>
              {years?.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>)}
            </select>
            <Input placeholder="Name, e.g. Mid Term 1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input type="date" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            <input type="date" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
          </div>
          {create.error instanceof ApiError && <p className="text-sm text-destructive">{create.error.message}</p>}
          <Button size="sm" onClick={() => create.mutate()} disabled={!form.academic_year_id || !form.name || !form.start_date || !form.end_date || create.isPending}>
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {examinations && examinations.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <FileCheck2 className="h-4 w-4" />
          <span>No examinations yet.</span>
        </div>
      )}
      {examinations && examinations.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Name</th>
                <th className="p-3">Academic year</th>
                <th className="p-3">Dates</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {examinations.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                  <td className="p-3 font-medium"><Link to={`/examinations/${e.id}`} className="hover:underline">{e.name}</Link></td>
                  <td className="p-3 text-muted-foreground">{yearById.get(e.academic_year_id) ?? "-"}</td>
                  <td className="p-3 text-muted-foreground">{e.start_date} – {e.end_date}</td>
                  <td className="p-3"><Badge variant={e.is_locked ? "outline" : "secondary"}>{e.is_locked ? "Locked" : "Open"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
