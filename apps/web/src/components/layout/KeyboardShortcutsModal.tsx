import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Command, Navigation, Zap, Compass, X } from "lucide-react";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: "navigation" | "actions" | "general";
}

const SHORTCUTS: ShortcutItem[] = [
  // Navigation
  { keys: ["G", "D"], description: "Go to Dashboard & Overview", category: "navigation" },
  { keys: ["G", "S"], description: "Go to Sales Orders & Invoices", category: "navigation" },
  { keys: ["G", "I"], description: "Go to Stock Movements & Inventory", category: "navigation" },
  { keys: ["G", "P"], description: "Go to POS & Counter Billing", category: "navigation" },
  { keys: ["G", "C"], description: "Go to Customers 360 Workspace", category: "navigation" },
  { keys: ["G", "T"], description: "Go to Organization & Brand Settings", category: "navigation" },
  { keys: ["G", "R"], description: "Go to Operational Reports", category: "navigation" },

  // Actions
  { keys: ["⌘ / Ctrl", "K"], description: "Open Command Palette & Search", category: "actions" },
  { keys: ["⌘ / Ctrl", "J"], description: "Open AI Copilot Autonomous HUD", category: "actions" },
  { keys: ["?"], description: "Open Keyboard Cheat Sheet", category: "actions" },
  { keys: ["Esc"], description: "Close active drawer, modal, or palette", category: "actions" },
];

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  const navigate = useNavigate();

  // Listen for 'g' sequence navigation
  useEffect(() => {
    let pendingG = false;
    let timer: NodeJS.Timeout | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }

      const key = e.key.toLowerCase();

      if (!pendingG && key === "g") {
        pendingG = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          pendingG = false;
        }, 1200);
        return;
      }

      if (pendingG) {
        pendingG = false;
        if (timer) clearTimeout(timer);

        switch (key) {
          case "d":
            navigate("/dashboard");
            onOpenChange(false);
            break;
          case "s":
            navigate("/sales/orders");
            onOpenChange(false);
            break;
          case "i":
            navigate("/inventory/movements");
            onOpenChange(false);
            break;
          case "p":
            navigate("/pos");
            onOpenChange(false);
            break;
          case "c":
            navigate("/customers");
            onOpenChange(false);
            break;
          case "t":
            navigate("/settings/company");
            onOpenChange(false);
            break;
          case "r":
            navigate("/reports");
            onOpenChange(false);
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [navigate, onOpenChange, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-border bg-card">
        <DialogHeader className="border-b border-border/80 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Command className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">Keyboard Shortcuts</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Navigate MaterialOS with keyboard velocity like Linear or Superhuman.
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-6">
          {/* Navigation Section */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              <Navigation className="h-3.5 w-3.5 text-primary" />
              <span>Navigation (Press keys sequentially)</span>
            </div>
            <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-muted/20">
              {SHORTCUTS.filter((s) => s.category === "navigation").map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <span className="text-foreground font-medium">{shortcut.description}</span>
                  <div className="flex items-center gap-1.5">
                    {shortcut.keys.map((k, kIdx) => (
                      <kbd
                        key={kIdx}
                        className="inline-flex min-w-[22px] items-center justify-center rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-xs"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Productivity & Actions Section */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Global Commands & Actions</span>
            </div>
            <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-muted/20">
              {SHORTCUTS.filter((s) => s.category === "actions").map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <span className="text-foreground font-medium">{shortcut.description}</span>
                  <div className="flex items-center gap-1.5">
                    {shortcut.keys.map((k, kIdx) => (
                      <kbd
                        key={kIdx}
                        className="inline-flex min-w-[22px] items-center justify-center rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-xs"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-muted/30 px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-primary" />
            <span>Pro tip: Press <kbd className="rounded border border-border bg-card px-1 py-0.2 font-mono text-[10px]">?</kbd> anywhere to show this sheet</span>
          </span>
          <span className="font-mono text-[11px]">MaterialOS v2.0</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
