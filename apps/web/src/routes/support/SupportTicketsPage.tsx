import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  open: "destructive",
  in_progress: "secondary",
  resolved: "success",
  closed: "outline",
};

const EMPTY_FORM = { subject: "", body: "", priority: "normal" };

export function SupportTicketsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => apiFetch<Ticket[]>("/support-tickets"),
  });

  const createTicket = useMutation({
    mutationFn: () => apiFetch<{ id: string }>("/support-tickets", { method: "POST", body: form }),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setAddOpen(false);
      setForm(EMPTY_FORM);
      navigate(`/support/${ticket.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Support</h1>
          <p className="text-sm text-muted-foreground">Questions or issues -- MaterialOS support replies right here.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>New ticket</Button>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={LifeBuoy}
          title="No tickets yet"
          description="Raise a ticket if something's broken or you need help."
          actionLabel="New ticket"
          onAction={() => setAddOpen(true)}
        />
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="cursor-pointer border-t border-border hover:bg-accent/50" onClick={() => navigate(`/support/${t.id}`)}>
                  <td className="px-4 py-2 font-medium text-primary">{t.subject}</td>
                  <td className="px-4 py-2 capitalize text-muted-foreground">{t.priority}</td>
                  <td className="px-4 py-2"><Badge variant={STATUS_VARIANT[t.status] ?? "outline"}>{t.status.replace("_", " ")}</Badge></td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(t.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New support ticket</DialogTitle>
            <DialogDescription>Tell us what's happening -- we'll reply here as soon as we can.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Cannot export GST report"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Describe the issue</Label>
              <Textarea
                rows={4}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="What were you trying to do, and what happened instead?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select
                className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          {createTicket.isError && <ErrorState error={createTicket.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createTicket.mutate()}
              disabled={!form.subject.trim() || !form.body.trim() || createTicket.isPending}
            >
              {createTicket.isPending ? "Submitting..." : "Submit ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
