import { useEffect, useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InspectorField {
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
}

export interface DesktopInspectorDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: { label: string; variant?: "default" | "success" | "warning" | "destructive" };
  fields?: InspectorField[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function DesktopInspectorDrawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  fields = [],
  actions,
  children,
}: DesktopInspectorDrawerProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Esc key closes inspector
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!open) return null;

  return (
    <aside
      aria-label="Desktop record inspector"
      className={cn(
        "fixed right-0 top-14 bottom-7 z-40 w-96 max-w-[90vw] border-l border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-in-out flex flex-col",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 px-4">
        <div className="flex flex-col min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
            {badge && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  badge.variant === "success" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                  badge.variant === "warning" && "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20",
                  badge.variant === "destructive" && "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                  (!badge.variant || badge.variant === "default") && "bg-primary/10 text-primary border border-primary/20"
                )}
              >
                {badge.label}
              </span>
            )}
          </div>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {fields.length > 0 && (
          <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
            {fields.map((f, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-xs">
                <span className="font-medium text-muted-foreground">{f.label}</span>
                <div className="flex items-center gap-1.5 font-medium text-foreground text-right truncate">
                  <span className="truncate">{f.value}</span>
                  {f.copyable && typeof f.value === "string" && (
                    <button
                      type="button"
                      onClick={() => handleCopy(f.value as string, `${i}`)}
                      aria-label={`Copy ${f.label}`}
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    >
                      {copiedKey === `${i}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {children}
      </div>

      {/* Footer Actions */}
      {actions && (
        <div className="shrink-0 border-t border-border/50 p-3 bg-muted/10 flex items-center justify-end gap-2">
          {actions}
        </div>
      )}
    </aside>
  );
}
