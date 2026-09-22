import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, downloadAuthenticatedFile, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Homework { id: string; section_id: string; subject_id: string; title: string; description: string | null; assigned_date: string; due_date: string; attachment_file_name: string | null; }
interface Subject { id: string; name: string; }
interface RosterEntry { student_id: string; first_name: string; last_name: string; roll_number: string | null; status: string; }

const STATUSES = [
  { value: "pending", label: "Pending", tone: "muted" },
  { value: "submitted", label: "Submitted", tone: "success" },
  { value: "late", label: "Late", tone: "warning" },
  { value: "missing", label: "Missing", tone: "destructive" },
] as const;

const TONE_CLASS: Record<string, string> = {
  success: "bg-emerald-600 text-white border-emerald-600",
  destructive: "bg-destructive text-destructive-foreground border-destructive",
  warning: "bg-amber-500 text-white border-amber-500",
  muted: "bg-muted-foreground text-white border-muted-foreground",
};

export function HomeworkDetailPage() {
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const queryClient = useQueryClient();
  const [marks, setMarks] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: homework } = useQuery({ queryKey: ["homework-list-for-detail"], queryFn: () => apiFetch<Homework[]>("/homework").then((all) => all.find((h) => h.id === homeworkId)!) });
  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: () => apiFetch<Subject[]>("/subjects") });
  const subjectName = subjects?.find((s) => s.id === homework?.subject_id)?.name;

  const { data: roster, isLoading } = useQuery({
    queryKey: ["homework-roster", homeworkId],
    queryFn: async () => {
      const rows = await apiFetch<RosterEntry[]>(`/homework/${homeworkId}/roster`);
      setMarks(Object.fromEntries(rows.map((r) => [r.student_id, r.status])));
      return rows;
    },
    enabled: !!homeworkId,
  });

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/homework/${homeworkId}/submissions/bulk`, {
        method: "POST",
        body: { records: Object.entries(marks).map(([student_id, status]) => ({ student_id, status })) },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["homework-roster", homeworkId] }),
  });

  const uploadAttachment = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<Homework>(`/homework/${homeworkId}/attachment`, { method: "POST", body: formData, isFormData: true });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["homework-list-for-detail"] }),
  });

  if (!homework) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{homework.title}</h1>
        <p className="text-sm text-muted-foreground">{subjectName ?? "-"} · Assigned {homework.assigned_date} · Due {homework.due_date}</p>
        {homework.description && <p className="mt-2 text-sm">{homework.description}</p>}
        <div className="mt-2 flex items-center gap-2 text-sm">
          {homework.attachment_file_name ? (
            <button
              type="button"
              className="flex items-center gap-1 text-primary hover:underline"
              onClick={() => downloadAuthenticatedFile(`/homework/${homeworkId}/attachment`, homework.attachment_file_name!)}
            >
              <Paperclip className="h-3.5 w-3.5" /> {homework.attachment_file_name}
            </button>
          ) : (
            <span className="text-muted-foreground">No attachment</span>
          )}
          <Button variant="outline" size="sm" className="h-7" onClick={() => fileInputRef.current?.click()} disabled={uploadAttachment.isPending}>
            {uploadAttachment.isPending ? "Uploading..." : homework.attachment_file_name ? "Replace" : "Attach file"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAttachment.mutate(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {roster && roster.length === 0 && <p className="text-sm text-muted-foreground">No students enrolled in this section.</p>}
      {roster && roster.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="p-3">Roll</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Submission</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.student_id} className="border-b border-border last:border-0">
                    <td className="p-3 text-muted-foreground">{r.roll_number ?? "-"}</td>
                    <td className="p-3 font-medium">{r.first_name} {r.last_name}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setMarks((m) => ({ ...m, [r.student_id]: s.value }))}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                              marks[r.student_id] === s.value ? TONE_CLASS[s.tone] : "border-input bg-background text-muted-foreground hover:bg-accent"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {save.error instanceof ApiError && <p className="text-sm text-destructive">{save.error.message}</p>}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save submissions"}
          </Button>
          {save.isSuccess && <span className="ml-3 text-sm text-emerald-600">Saved.</span>}
        </div>
      )}
    </div>
  );
}
