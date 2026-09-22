import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Megaphone, Paperclip } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, downloadAuthenticatedFile } from "@/lib/api";

interface Announcement { id: string; title: string; body: string; target_type: string; created_at: string; is_read: boolean; attachment_file_name: string | null; }

const TARGET_LABELS: Record<string, string> = { school: "Whole school", campus: "Campus notice", class: "Class notice", section: "Section notice" };

export function GuardianPortalAnnouncementsPage() {
  const queryClient = useQueryClient();
  const { data: announcements, isLoading } = useQuery({ queryKey: ["guardian-portal-announcements"], queryFn: () => apiFetch<Announcement[]>("/guardian-portal/announcements") });

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/guardian-portal/announcements/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guardian-portal-announcements"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Announcements</h1>
        <p className="text-sm text-muted-foreground">Notices from the school relevant to your children.</p>
      </div>

      {isLoading && <Skeleton className="h-32" />}
      {announcements && announcements.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <Megaphone className="h-4 w-4" />
          <span>No announcements yet.</span>
        </div>
      )}

      <div className="space-y-3">
        {announcements?.map((a) => (
          <div
            key={a.id}
            className={`space-y-1.5 rounded-lg border p-4 ${a.is_read ? "border-border" : "border-primary bg-accent/40"}`}
            onClick={() => !a.is_read && markRead.mutate(a.id)}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{TARGET_LABELS[a.target_type]}</Badge>
                {!a.is_read && <Badge>New</Badge>}
              </div>
            </div>
            <p className="text-sm">{a.body}</p>
            {a.attachment_file_name && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadAuthenticatedFile(`/guardian-portal/announcements/${a.id}/attachment`, a.attachment_file_name!);
                }}
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
