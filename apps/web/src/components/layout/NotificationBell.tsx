import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: unread } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => apiFetch<{ unread_count: number }>("/notifications/unread-count"),
    refetchInterval: 30_000,
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<Notification[]>("/notifications"),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const count = unread?.unread_count ?? 0;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-md border border-border bg-background shadow-lg">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">Notifications</div>
          <div className="max-h-96 overflow-y-auto">
            {notifications && notifications.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing to see here.</p>
            )}
            {notifications?.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.is_read && markRead.mutate(n.id)}
                className={cn(
                  "block w-full border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                  !n.is_read && "bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{n.title}</span>
                  {!n.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
