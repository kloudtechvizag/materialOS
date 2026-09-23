import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

import { type Enquiry, STATUS_LABEL, followUpUrgency } from "./types";

const DROPPABLE_COLUMNS = ["open", "contacted", "closed"] as const;
const BOARD_COLUMNS = ["open", "contacted", "converted", "closed"] as const;

export function EnquiryBoard({ enquiries, onSelect }: { enquiries: Enquiry[]; onSelect: (enquiry: Enquiry) => void }) {
  const queryClient = useQueryClient();
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch<Enquiry>(`/admission-enquiries/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries-summary"] });
    },
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {BOARD_COLUMNS.map((status) => {
        const columnEnquiries = enquiries.filter((e) => e.status === status);
        const droppable = (DROPPABLE_COLUMNS as readonly string[]).includes(status);
        return (
          <div
            key={status}
            className={cn(
              "flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3",
              dragOverColumn === status && droppable && "border-primary bg-primary/5"
            )}
            onDragOver={(e) => { if (droppable) { e.preventDefault(); setDragOverColumn(status); } }}
            onDragLeave={() => setDragOverColumn((c) => (c === status ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverColumn(null);
              if (!droppable) return;
              const id = e.dataTransfer.getData("text/enquiry-id");
              if (id) patchStatus.mutate({ id, status });
            }}
          >
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-medium">{STATUS_LABEL[status]}</p>
              <Badge variant="outline">{columnEnquiries.length}</Badge>
            </div>
            <div className="flex min-h-[4rem] flex-col gap-2">
              {columnEnquiries.map((enquiry) => {
                const urgency = followUpUrgency(enquiry, today);
                const draggable = status === "open" || status === "contacted" || status === "closed";
                return (
                  <button
                    key={enquiry.id}
                    type="button"
                    draggable={draggable}
                    onDragStart={(e) => { e.dataTransfer.setData("text/enquiry-id", enquiry.id); }}
                    onClick={() => onSelect(enquiry)}
                    className={cn(
                      "rounded-lg border border-border bg-card p-3 text-left shadow-sm hover:border-primary/50",
                      draggable && "cursor-grab active:cursor-grabbing"
                    )}
                  >
                    <p className="text-sm font-medium">{enquiry.student_name}</p>
                    <p className="text-xs text-muted-foreground">{enquiry.guardian_name}</p>
                    {enquiry.desired_grade && <p className="mt-1 text-xs text-muted-foreground">{enquiry.desired_grade}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {enquiry.has_application && <Badge variant="secondary" className="text-[10px]">Application started</Badge>}
                      {enquiry.assigned_to_name && <Badge variant="outline" className="text-[10px]">{enquiry.assigned_to_name}</Badge>}
                      {urgency === "overdue" && <span className="text-[10px] font-medium text-destructive">Follow-up overdue</span>}
                      {urgency === "today" && <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Follow-up today</span>}
                    </div>
                  </button>
                );
              })}
              {columnEnquiries.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">No enquiries here.</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
