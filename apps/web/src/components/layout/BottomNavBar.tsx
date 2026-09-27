import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, MessageSquare, Menu } from "lucide-react";
import { useSidebarStore } from "@/store/sidebar";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  isAction?: boolean;
  match?: (pathname: string) => boolean;
}

export function BottomNavBar() {
  const location = useLocation();
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      match: (path) => path === "/" || path === "/dashboard",
    },
    {
      label: "POS",
      href: "/pos",
      icon: ShoppingCart,
      match: (path) => path.startsWith("/pos"),
    },
    {
      label: "Inventory",
      href: "/items",
      icon: Package,
      match: (path) => path.startsWith("/items") || path.startsWith("/inventory"),
    },
    {
      label: "Messages",
      href: "/settings/communication",
      icon: MessageSquare,
      match: (path) => path.startsWith("/settings/communication"),
    },
    {
      label: "Menu",
      icon: Menu,
      isAction: true,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed inset-x-0 bottom-0 z-40 block border-t border-border bg-card/95 backdrop-blur-md pb-safe md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      <div className="flex h-14 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.match ? item.match(location.pathname) : false;

          if (item.isAction) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => setMobileOpen(true)}
                className="group relative flex flex-1 flex-col items-center justify-center py-1 text-muted-foreground transition-colors hover:text-foreground active:scale-95"
                aria-label="Open Full Menu"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg transition-transform group-active:scale-90">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium leading-none tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              to={item.href || "#"}
              className={cn(
                "group relative flex flex-1 flex-col items-center justify-center py-1 transition-colors active:scale-95",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute -top-[1px] left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary animate-in fade-in zoom-in-50 duration-200" />
              )}
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-transform group-active:scale-90",
                  isActive && "bg-primary/10 text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] leading-none tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNavBar;
