import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";

interface Message {
  id: string;
  body: string;
  author_user_id: string | null;
  author_platform_admin_id: string | null;
  created_at: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success" | "destructive"> = {
  open: "destructive",
  in_progress: "secondary",
  resolved: "success",
  closed: "outline",
};

export function SupportTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");

  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ["support-ticket", ticketId],
    queryFn: () => apiFetch<TicketDetail>(`/support-tickets/${ticketId}`),
  });

  const sendReply = useMutation({
    mutationFn: () => apiFetch(`/support-tickets/${ticketId}/messages`, { method: "POST", body: { body: reply } }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  return (
    <div className="space-y-6">
      <Link to="/support" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; All tickets
      </Link>

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {ticket && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{ticket.subject}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Priority: <span className="capitalize">{ticket.priority}</span> &middot; opened {new Date(ticket.created_at).toLocaleString()}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[ticket.status] ?? "outline"}>{ticket.status.replace("_", " ")}</Badge>
          </div>

          <div className="space-y-3">
            {ticket.messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg border p-4 ${m.author_platform_admin_id ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}
              >
                <p className="text-xs text-muted-foreground">
                  {m.author_platform_admin_id ? "MaterialOS support" : "You"} &middot; {new Date(m.created_at).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-lg border border-border p-4">
            <Textarea
              placeholder={ticket.status === "closed" || ticket.status === "resolved" ? "Reply to reopen this ticket..." : "Reply..."}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
            />
            {sendReply.isError && <ErrorState error={sendReply.error} />}
            <div className="flex justify-end">
              <Button onClick={() => sendReply.mutate()} disabled={!reply.trim() || sendReply.isPending}>
                Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
