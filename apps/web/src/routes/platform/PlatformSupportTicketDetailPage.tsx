import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { platformFetch } from "@/lib/platformApi";

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

const STATUS_BADGE: Record<string, "success" | "secondary" | "destructive" | "outline"> = {
  open: "destructive",
  in_progress: "secondary",
  resolved: "success",
  closed: "outline",
};

export function PlatformSupportTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");

  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ["platform-support-ticket", ticketId],
    queryFn: () => platformFetch<TicketDetail>(`/platform/support-tickets/${ticketId}`),
  });

  const sendReply = useMutation({
    mutationFn: () => platformFetch(`/platform/support-tickets/${ticketId}/messages`, { method: "POST", body: { body: reply } }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["platform-support-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["platform-support-tickets"] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => platformFetch(`/platform/support-tickets/${ticketId}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-support-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["platform-support-tickets"] });
    },
  });

  return (
    <div className="space-y-6">
      <Link to="/platform/support-tickets" className="text-sm text-white/60 hover:text-white">
        &larr; All tickets
      </Link>

      {isLoading && <Skeleton className="h-64 bg-white/10" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {ticket && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{ticket.subject}</h1>
              <p className="mt-1 text-sm text-white/60">
                Priority: <span className="capitalize">{ticket.priority}</span> &middot; opened {new Date(ticket.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_BADGE[ticket.status] ?? "outline"}>{ticket.status.replace("_", " ")}</Badge>
              {ticket.status !== "resolved" && ticket.status !== "closed" && (
                <Button
                  variant="outline"
                  className="bg-white text-foreground hover:text-accent-foreground"
                  onClick={() => updateStatus.mutate("resolved")}
                  disabled={updateStatus.isPending}
                >
                  Mark resolved
                </Button>
              )}
              {ticket.status !== "closed" && (
                <Button
                  variant="outline"
                  className="bg-white text-foreground hover:text-accent-foreground"
                  onClick={() => updateStatus.mutate("closed")}
                  disabled={updateStatus.isPending}
                >
                  Close
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {ticket.messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl p-4 ${m.author_platform_admin_id ? "bg-primary/20 text-white" : "bg-white text-foreground"}`}
              >
                <p className="text-xs opacity-60">{m.author_platform_admin_id ? "MaterialOS support" : "Tenant"} &middot; {new Date(m.created_at).toLocaleString()}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-xl bg-white p-4 text-foreground">
            <Textarea
              placeholder="Reply to this tenant..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
            />
            {sendReply.isError && <ErrorState error={sendReply.error} />}
            <div className="flex justify-end">
              <Button onClick={() => sendReply.mutate()} disabled={!reply.trim() || sendReply.isPending}>
                Send reply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
