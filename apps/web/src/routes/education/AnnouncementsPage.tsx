import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Paperclip } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, downloadAuthenticatedFile, ApiError } from "@/lib/api";

interface AcademicYear { id: string; is_current: boolean; }
interface SchoolClass { id: string; academic_year_id: string; name: string; }
interface Section { id: string; school_class_id: string; name: string; }
interface Branch { id: string; name: string; }
interface Announcement {
  id: string; title: string; body: string; target_type: string;
  target_branch_id: string | null; target_school_class_id: string | null; target_section_id: string | null; created_at: string;
  attachment_file_name: string | null;
}

const TARGET_LABELS: Record<string, string> = { school: "Whole school", campus: "Campus", class: "Class", section: "Section" };

/** Communication Center (spec sec20): staff post an announcement
 * targeted at the whole school, a class, or a section; it appears in
 * the Guardian Portal for exactly the guardians in scope. */
export function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", target_type: "school", target_branch_id: "", target_school_class_id: "", target_section_id: "", expires_at: "" });

  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });
  const branchById = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const activeYearId = years?.find((y) => y.is_current)?.id ?? years?.[0]?.id ?? null;
  const { data: classes } = useQuery({
    queryKey: ["school-classes", activeYearId],
    queryFn: () => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${activeYearId}`),
    enabled: !!activeYearId,
  });
  const { data: sections } = useQuery({
    queryKey: ["sections", form.target_school_class_id],
    queryFn: () => apiFetch<Section[]>(`/sections?school_class_id=${form.target_school_class_id}`),
    enabled: !!form.target_school_class_id,
  });
  const { data: announcements, isLoading } = useQuery({ queryKey: ["announcements"], queryFn: () => apiFetch<Announcement[]>("/announcements") });
  const { data: allClasses } = useQuery({
    queryKey: ["all-school-classes"],
    queryFn: async () => (await Promise.all((await apiFetch<AcademicYear[]>("/academic-years")).map((y) => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${y.id}`)))).flat(),
  });
  const { data: allSections } = useQuery({ queryKey: ["all-sections"], queryFn: () => apiFetch<Section[]>("/sections") });

  const classById = new Map((allClasses ?? []).map((c) => [c.id, c.name]));
  const sectionById = new Map((allSections ?? []).map((s) => [s.id, s.name]));

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const announcement = await apiFetch<Announcement>("/announcements", {
        method: "POST",
        body: {
          title: form.title, body: form.body, target_type: form.target_type,
          target_branch_id: form.target_type === "campus" ? form.target_branch_id || null : null,
          target_school_class_id: form.target_type === "school" || form.target_type === "campus" ? null : form.target_school_class_id || null,
          target_section_id: form.target_type === "section" ? form.target_section_id || null : null,
          expires_at: form.expires_at || null,
        },
      });
      if (attachmentFile) {
        const formData = new FormData();
        formData.append("file", attachmentFile);
        await apiFetch(`/announcements/${announcement.id}/attachment`, { method: "POST", body: formData, isFormData: true });
      }
      return announcement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setShowCreate(false);
      setForm({ title: "", body: "", target_type: "school", target_branch_id: "", target_school_class_id: "", target_section_id: "", expires_at: "" });
      setAttachmentFile(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Announcements</h1>
          <p className="text-sm text-muted-foreground">Post a notice for the whole school, one class, or one section.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>{showCreate ? "Cancel" : "New announcement"}</Button>
      </div>

      {showCreate && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <textarea
            placeholder="Message"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={form.target_type}
              onChange={(e) => setForm((f) => ({ ...f, target_type: e.target.value, target_branch_id: "", target_school_class_id: "", target_section_id: "" }))}
            >
              <option value="school">Whole school</option>
              {branches && branches.length > 1 && <option value="campus">One campus</option>}
              <option value="class">One class</option>
              <option value="section">One section</option>
            </select>
            {form.target_type === "campus" && (
              <select
                className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={form.target_branch_id}
                onChange={(e) => setForm((f) => ({ ...f, target_branch_id: e.target.value }))}
              >
                <option value="">Campus...</option>
                {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            {(form.target_type === "class" || form.target_type === "section") && (
              <select
                className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={form.target_school_class_id}
                onChange={(e) => setForm((f) => ({ ...f, target_school_class_id: e.target.value, target_section_id: "" }))}
              >
                <option value="">Class...</option>
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {form.target_type === "section" && (
              <select
                className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={form.target_section_id}
                onChange={(e) => setForm((f) => ({ ...f, target_section_id: e.target.value }))}
                disabled={!form.target_school_class_id}
              >
                <option value="">Section...</option>
                {sections?.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
              </select>
            )}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Expires (optional)
              <input type="date" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Attachment (optional)
              <input type="file" className="text-xs" onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {create.error instanceof ApiError && <p className="text-sm text-destructive">{create.error.message}</p>}
          <Button
            size="sm"
            onClick={() => create.mutate()}
            disabled={
              !form.title || !form.body || create.isPending ||
              (form.target_type === "campus" && !form.target_branch_id) ||
              (form.target_type === "class" && !form.target_school_class_id) ||
              (form.target_type === "section" && (!form.target_school_class_id || !form.target_section_id))
            }
          >
            {create.isPending ? "Publishing..." : "Publish"}
          </Button>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {announcements && announcements.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <Megaphone className="h-4 w-4" />
          <span>No announcements yet.</span>
        </div>
      )}
      <div className="space-y-3">
        {announcements?.map((a) => (
          <div key={a.id} className="space-y-1.5 rounded-lg border border-border p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString()} ·{" "}
                  {a.target_type === "school"
                    ? TARGET_LABELS.school
                    : a.target_type === "campus"
                    ? branchById.get(a.target_branch_id ?? "") ?? "Campus"
                    : a.target_type === "class"
                    ? `${classById.get(a.target_school_class_id ?? "") ?? "Class"}`
                    : `${classById.get(a.target_school_class_id ?? "") ?? "Class"} - ${sectionById.get(a.target_section_id ?? "") ?? "Section"}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{TARGET_LABELS[a.target_type]}</Badge>
                <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(a.id)}>Delete</button>
              </div>
            </div>
            <p className="text-sm">{a.body}</p>
            {a.attachment_file_name && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={() => downloadAuthenticatedFile(`/announcements/${a.id}/attachment`, a.attachment_file_name!)}
              >
                <Paperclip className="h-3 w-3" /> {a.attachment_file_name}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
