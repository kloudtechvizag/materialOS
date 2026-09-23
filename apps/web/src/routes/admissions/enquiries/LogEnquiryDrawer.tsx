import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";

import { type Branch, type DuplicateCandidate, type Employee, type Enquiry, STATUS_LABEL, employeeName } from "./types";

const EMPTY_FORM = {
  branch_id: "", student_name: "", desired_grade: "", guardian_name: "", guardian_phone: "", guardian_email: "",
  source: "", follow_up_date: "", assigned_to_id: "", notes: "",
};

export function LogEnquiryDrawer({
  open, onOpenChange, branches, employees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[] | undefined;
  employees: Employee[] | undefined;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [debouncedName, setDebouncedName] = useState("");
  const [debouncedPhone, setDebouncedPhone] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedName(form.student_name.trim());
      setDebouncedPhone(form.guardian_phone.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [form.student_name, form.guardian_phone]);

  const { data: duplicates } = useQuery({
    queryKey: ["admission-enquiry-duplicates", debouncedName, debouncedPhone],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedName) params.set("student_name", debouncedName);
      if (debouncedPhone) params.set("guardian_phone", debouncedPhone);
      return apiFetch<DuplicateCandidate[]>(`/admission-enquiries/duplicates?${params.toString()}`);
    },
    enabled: open && (debouncedName.length > 1 || debouncedPhone.length > 5),
  });

  const createEnquiry = useMutation({
    mutationFn: () =>
      apiFetch<Enquiry>("/admission-enquiries", {
        method: "POST",
        body: {
          ...form,
          guardian_phone: form.guardian_phone || null,
          guardian_email: form.guardian_email || null,
          source: form.source || null,
          follow_up_date: form.follow_up_date || null,
          desired_grade: form.desired_grade || null,
          assigned_to_id: form.assigned_to_id || null,
          notes: form.notes || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries-summary"] });
      onOpenChange(false);
      setForm(EMPTY_FORM);
    },
  });

  return (
    <Drawer open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setForm(EMPTY_FORM); }}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Log enquiry</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="space-y-4">
          <div className="space-y-1.5">
            <Label>Campus</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={form.branch_id}
              onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
            >
              <option value="">Select campus...</option>
              {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Student name</Label>
            <Input value={form.student_name} onChange={(e) => setForm((f) => ({ ...f, student_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Desired grade</Label>
            <Input value={form.desired_grade} onChange={(e) => setForm((f) => ({ ...f, desired_grade: e.target.value }))} placeholder="Grade 3" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Guardian name</Label>
              <Input value={form.guardian_name} onChange={(e) => setForm((f) => ({ ...f, guardian_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Guardian phone</Label>
              <Input value={form.guardian_phone} onChange={(e) => setForm((f) => ({ ...f, guardian_phone: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Guardian email</Label>
            <Input type="email" value={form.guardian_email} onChange={(e) => setForm((f) => ({ ...f, guardian_email: e.target.value }))} />
          </div>

          {duplicates && duplicates.length > 0 && (
            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Possible duplicate</p>
                {duplicates.map((d) => (
                  <p key={d.id} className="text-xs">
                    {d.student_name} · {d.guardian_name}{d.guardian_phone ? ` · ${d.guardian_phone}` : ""} -- already {STATUS_LABEL[d.status] ?? d.status}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="Website, Referral, Walk-in..." />
            </div>
            <div className="space-y-1.5">
              <Label>Follow-up date</Label>
              <Input type="date" value={form.follow_up_date} onChange={(e) => setForm((f) => ({ ...f, follow_up_date: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Assign to</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={form.assigned_to_id}
              onChange={(e) => setForm((f) => ({ ...f, assigned_to_id: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {employees?.map((e) => <option key={e.id} value={e.id}>{employeeName(e)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Anything else worth remembering about this enquiry..." />
          </div>

          {createEnquiry.isError && <ErrorState error={createEnquiry.error} />}
          <Button
            className="w-full"
            onClick={() => createEnquiry.mutate()}
            disabled={!form.branch_id || !form.student_name || !form.guardian_name || createEnquiry.isPending}
          >
            {createEnquiry.isPending ? "Saving..." : "Save enquiry"}
          </Button>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
