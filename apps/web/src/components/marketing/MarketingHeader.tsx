import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const NAV_LINKS = [
  { label: "Product", href: "/product" },
  { label: "Industries", href: "/industries" },
  { label: "Features", href: "/features" },
  { label: "Why MaterialOS", href: "/why-materialos" },
  { label: "Pricing", href: "/pricing" },
];

export type AuthAction = "login" | "signup";

/** Single source of truth for the public site's top nav -- used by
 * MarketingLayout (every marketing page) and AuthLayout (Login/Signup/
 * portal login), so the header never drifts between them. `active`
 * marks which auth action the current page IS, so Login/Signup can show
 * where the visitor already is without inventing a separate style. */
export function MarketingHeader({ active }: { active?: AuthAction }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <img src="/brand/symbol.svg" alt="" className="h-10 w-10" />
          <span className="text-xl font-semibold text-foreground">MaterialOS</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn("hover:text-foreground", location.pathname === link.href && "text-foreground")}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" aria-current={active === "login" ? "page" : undefined} className={cn(active === "login" && "bg-accent text-foreground")} asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button
            aria-current={active === "signup" ? "page" : undefined}
            className={cn("bg-[#7C3AED] text-white hover:bg-[#6D28D9]", active === "signup" && "bg-[#6D28D9]")}
            asChild
          >
            <Link to="/signup">Start free</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-black/[0.06] bg-white transition-[max-height,opacity] duration-200 ease-in-out md:hidden",
          mobileOpen ? "max-h-[26rem] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <nav className="flex flex-col gap-1 px-6 py-4 text-sm font-medium text-muted-foreground">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "rounded-md px-2 py-2.5 hover:bg-accent hover:text-foreground",
                location.pathname === link.href && "text-foreground",
              )}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="my-2 h-px bg-[#E2E8F0]" />
          <Link
            to="/login"
            className={cn(
              "rounded-md px-2 py-2.5 hover:bg-accent hover:text-foreground",
              active === "login" && "text-foreground",
            )}
            onClick={() => setMobileOpen(false)}
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="mt-1 rounded-md bg-[#7C3AED] px-2 py-2.5 text-center font-medium text-white hover:bg-[#6D28D9]"
            onClick={() => setMobileOpen(false)}
          >
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}
