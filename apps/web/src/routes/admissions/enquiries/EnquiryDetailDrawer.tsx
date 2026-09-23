import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Phone, StickyNote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailField, Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";

import { ACTIVITY_LABEL, type AcademicYear, type Employee, type Enquiry, type EnquiryActivity, STATUS_LABEL, employeeName } from "./types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const MANUAL_STATUSES = ["open", "contacted", "closed"];

export function EnquiryDetailDrawer({
  enquiry, employees, years, onClose,
}: {
  enquiry: Enquiry | null;
  employees: Employee[] | undefined;
  years: AcademicYear[] | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [noteDraft, setNoteDraft] = useState("");
  const [callDraft, setCallDraft] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");

  const { data: activities, isLoading: activitiesLoading, error: activitiesError } = useQuery({
    queryKey: ["admission-enquiry-activities", enquiry?.id],
    queryFn: () => apiFetch<EnquiryActivity[]>(`/admission-enquiries/${enquiry!.id}/activities`),
    enabled: enquiry !== null,
  });

  const patchEnquiry = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch<Enquiry>(`/admission-enquiries/${enquiry!.id}`, { method: "PATCH", body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries-summary"] });
      queryClient.invalidateQueries({ queryKey: ["admission-enquiry-activities", enquiry?.id] });
    },
  });

  const logActivity = useMutation({
    mutationFn: (body: { activity_type: string; description: string }) =>
      apiFetch<EnquiryActivity>(`/admission-enquiries/${enquiry!.id}/activities`, { method: "POST", body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-enquiry-activities", enquiry?.id] });
      setNoteDraft("");
      setCallDraft("");
    },
  });

  const convertToApplication = useMutation({
    mutationFn: async () => {
      const currentYear = years?.find((y) => y.is_current) ?? years?.[0];
      if (!currentYear) throw new Error("Add an academic year first.");
      const [first_name, ...rest] = enquiry!.student_name.trim().split(" ");
      return apiFetch(`/admission-applications`, {
        method: "POST",
        body: {
          branch_id: enquiry!.branch_id, enquiry_id: enquiry!.id, first_name, last_name: rest.join(" ") || "-", desired_grade: enquiry!.desired_grade,
          academic_year_id: currentYear.id, guardian_name: enquiry!.guardian_name, guardian_phone: enquiry!.guardian_phone,
        },
      });
    },
    onSuccess: (application: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries-summary"] });
      onClose();
      navigate(`/admission-applications/${(application as { id: string }).id}`);
    },
  });

  if (!enquiry) return null;

  return (
    <Drawer open={enquiry !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{enquiry.student_name}</DrawerTitle>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant={enquiry.status === "converted" ? "success" : enquiry.status === "closed" ? "destructive" : enquiry.status === "contacted" ? "secondary" : "outline"}>
              {STATUS_LABEL[enquiry.status] ?? enquiry.status}
            </Badge>
            {enquiry.has_application && <Badge variant="secondary">Application started</Badge>}
          </div>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <div>
            <DetailField label="Desired grade" value={enquiry.desired_grade ?? <span className="text-muted-foreground">Not specified</span>} />
            <DetailField label="Guardian" value={`${enquiry.guardian_name}${enquiry.guardian_phone ? ` · ${enquiry.guardian_phone}` : ""}`} />
            {enquiry.guardian_email && <DetailField label="Guardian email" value={enquiry.guardian_email} />}
            <DetailField label="Source" value={enquiry.source ?? <span className="text-muted-foreground">Not set</span>} />
            <DetailField label="Logged" value={formatDate(enquiry.created_at)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={MANUAL_STATUSES.includes(enquiry.status) ? enquiry.status : enquiry.status}
                disabled={enquiry.status === "converted"}
                onChange={(e) => patchEnquiry.mutate({ status: e.target.value })}
              >
                {enquiry.status === "converted" && <option value="converted">Converted</option>}
                {MANUAL_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned to</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={enquiry.assigned_to_id ?? ""}
                onChange={(e) => patchEnquiry.mutate({ assigned_to_id: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {employees?.map((e) => <option key={e.id} value={e.id}>{employeeName(e)}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Follow-up date</Label>
            <div className="flex gap-2">
              <input
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={followUpDraft || enquiry.follow_up_date || ""}
                onChange={(e) => setFollowUpDraft(e.target.value)}
              />
              <Button
                size="sm" variant="outline"
                disabled={!followUpDraft || followUpDraft === enquiry.follow_up_date || patchEnquiry.isPending}
                onClick={() => patchEnquiry.mutate({ follow_up_date: followUpDraft })}
              >
                Save
              </Button>
            </div>
          </div>

          {!enquiry.has_application && enquiry.status !== "closed" && (
            <Button className="w-full" onClick={() => convertToApplication.mutate()} disabled={convertToApplication.isPending}>
              {convertToApplication.isPending ? "Converting..." : "Convert to application"}
            </Button>
          )}
          {convertToApplication.isError && <ErrorState error={convertToApplication.error} />}
          {patchEnquiry.isError && <ErrorState error={patchEnquiry.error} />}

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium">Log an activity</p>
            <div className="space-y-2">
              <Textarea
                placeholder="Add a note about this family..." value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2}
              />
              <Button
                size="sm" variant="outline"
                disabled={!noteDraft.trim() || logActivity.isPending}
                onClick={() => logActivity.mutate({ activity_type: "note", description: noteDraft.trim() })}
              >
                <StickyNote className="h-4 w-4" /> Add note
              </Button>
            </div>
            <div className="space-y-2">
              <Textarea
                placeholder="Summarize a call with the guardian..." value={callDraft} onChange={(e) => setCallDraft(e.target.value)} rows={2}
              />
              <Button
                size="sm" variant="outline"
                disabled={!callDraft.trim() || logActivity.isPending}
                onClick={() => logActivity.mutate({ activity_type: "call", description: callDraft.trim() })}
              >
                <Phone className="h-4 w-4" /> Log call
              </Button>
            </div>
            {logActivity.isError && <ErrorState error={logActivity.error} />}
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium">Activity timeline</p>
            {activitiesLoading && <Skeleton className="h-24" />}
            {activitiesError && <ErrorState error={activitiesError} />}
            {activities && activities.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            {activities && activities.length > 0 && (
              <ol className="space-y-3">
                {activities.map((a) => (
                  <li key={a.id} className="border-l-2 border-border pl-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{ACTIVITY_LABEL[a.activity_type] ?? a.activity_type}</span>
                      <span>·</span>
                      <span>{formatDateTime(a.created_at)}</span>
                      {a.created_by_name && <span>· {a.created_by_name}</span>}
                    </div>
                    <p className="mt-0.5 text-sm">{a.description}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
