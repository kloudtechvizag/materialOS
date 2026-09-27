import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { SidebarFooter } from "@/components/layout/sidebar/SidebarFooter";
import { SidebarNav } from "@/components/layout/sidebar/SidebarNav";
import { useAuthStore } from "@/store/auth";
import { useSidebarStore } from "@/store/sidebar";

/** Small/tablet nav. Backdrop click, Escape, focus trap, and body-scroll
 * lock all come from Radix Dialog for free -- only the sliding-panel look
 * and the MaterialOS content (SidebarNav/SidebarFooter, shared with the
 * desktop sidebar) are custom. */
export function MobileDrawer() {
  const open = useSidebarStore((s) => s.mobileOpen);
  const setOpen = useSidebarStore((s) => s.setMobileOpen);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();

  function handleLogout() {
    setOpen(false);
    clearSession();
    navigate("/login");
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-[state=closed]:opacity-0 data-[state=open]:opacity-100" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 z-50 flex h-full w-[280px] max-w-[85vw] flex-col rounded-r-2xl border-r border-white/10 bg-brand-navy pt-safe pb-safe text-brand-navy-foreground shadow-2xl outline-none transition-transform duration-200 data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
            <div className="flex items-center gap-2.5">
              <img src="/brand/symbol.svg" alt="" className="h-7 w-7" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight">MaterialOS</span>
                <span className="text-[10px] text-brand-navy-muted">Enterprise Suite</span>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-navy-muted hover:bg-white/10 hover:text-white active:scale-95 transition-all"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarNav collapsed={false} onNavigate={() => setOpen(false)} />
          </div>
          <SidebarFooter collapsed={false} onLogout={handleLogout} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
