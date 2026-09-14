import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { platformFetch } from "@/lib/platformApi";
import { LifeBuoy } from "lucide-react";

interface PlatformTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
}

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const STATUS_BADGE: Record<string, "success" | "secondary" | "destructive" | "outline"> = {
  open: "destructive",
  in_progress: "secondary",
  resolved: "success",
  closed: "outline",
};

export function PlatformSupportTicketsPage() {
  const [status, setStatus] = useState("open");
  const { data: tickets, isLoading, error, refetch } = useQuery({
    queryKey: ["platform-support-tickets", status],
    queryFn: () =>
      platformFetch<PlatformTicket[]>(`/platform/support-tickets${status ? `?status=${status}` : ""}`),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Support tickets</h1>
        <p className="mt-1 text-sm text-white/60">Every tenant's tickets, in one inbox.</p>
      </div>

      <div className="flex items-center gap-1 border-b border-white/10">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`border-b-2 px-3 py-2 text-sm ${
              status === tab.value ? "border-white text-white" : "border-transparent text-white/50 hover:text-white/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <Skeleton className="h-64 bg-white/10" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {tickets && tickets.length === 0 && (
        <div className="rounded-xl bg-white p-6">
          <EmptyState icon={LifeBuoy} title="No tickets here" description="Nothing matches this filter right now." />
        </div>
      )}

      {tickets && tickets.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white text-foreground shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link to={`/platform/support-tickets/${t.id}`} className="font-medium text-primary hover:underline">
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.tenant_name} ({t.tenant_slug})</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{t.priority}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[t.status] ?? "outline"}>{t.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(t.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
