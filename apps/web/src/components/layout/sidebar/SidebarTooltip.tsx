import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Only used in collapsed (icon-only) desktop mode. The sidebar nav needs
 * `overflow-y: auto` to scroll, and per the CSS spec that forces
 * `overflow-x` to compute as `auto` too (not `visible`) even though we
 * never set it -- so a plain absolutely-positioned tooltip gets clipped
 * at the sidebar's edge no matter what. Rendering it through a portal to
 * `document.body`, positioned via the trigger's own bounding rect, is
 * what actually escapes that clip. */
export function SidebarTooltip({ label, show, children }: { label: string; show: boolean; children: ReactNode }) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  if (!show) return <>{children}</>;

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.top + rect.height / 2, left: rect.right + 8 });
  }

  return (
    <div
      ref={triggerRef}
      className="flex"
      onMouseEnter={() => {
        updatePosition();
        setVisible(true);
      }}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => {
        updatePosition();
        setVisible(true);
      }}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[100] -translate-y-1/2 whitespace-nowrap rounded-md bg-brand-navy px-2 py-1 text-xs font-medium text-brand-navy-foreground shadow-md"
            style={{ top: coords.top, left: coords.left }}
          >
            {label}
          </span>,
          document.body
        )}
    </div>
  );
}
