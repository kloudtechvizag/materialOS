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

export function MarketingHeader({ active, theme }: { active?: AuthAction; theme?: "dark" | "light" }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDark = theme ? theme === "dark" : location.pathname === "/" || location.pathname === "/pricing";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-200",
        isDark
          ? "border-b border-white/10 bg-[#070B14]/80 backdrop-blur-md supports-[backdrop-filter]:bg-[#070B14]/70 text-white"
          : "border-b border-black/[0.06] bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 text-foreground",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <img src="/brand/symbol.svg" alt="" className="h-9 w-9" />
          <span className={cn("text-xl font-bold tracking-tight", isDark ? "text-white" : "text-foreground")}>
            Material<span className="text-violet-400">OS</span>
          </span>
        </Link>

        <nav
          className={cn(
            "hidden items-center gap-6 text-sm font-medium md:flex",
            isDark ? "text-zinc-400" : "text-muted-foreground",
          )}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "transition-colors",
                isDark
                  ? location.pathname === link.href
                    ? "text-white font-semibold"
                    : "hover:text-white"
                  : location.pathname === link.href
                    ? "text-foreground font-semibold"
                    : "hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            aria-current={active === "login" ? "page" : undefined}
            className={cn(
              isDark
                ? "text-zinc-300 hover:text-white hover:bg-white/10"
                : active === "login"
                  ? "bg-accent text-foreground"
                  : "",
            )}
            asChild
          >
            <Link to="/login">Sign in</Link>
          </Button>
          <Button
            aria-current={active === "signup" ? "page" : undefined}
            className={cn(
              "font-medium shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all hover:shadow-[0_0_25px_rgba(124,58,237,0.6)]",
              isDark
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500"
                : "bg-[#7C3AED] text-white hover:bg-[#6D28D9]",
              active === "signup" && "ring-2 ring-violet-400",
            )}
            asChild
          >
            <Link to="/signup">Start Free Trial</Link>
          </Button>
        </div>

        <button
          type="button"
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors md:hidden",
            isDark ? "text-zinc-300 hover:bg-white/10" : "text-foreground hover:bg-black/5",
          )}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out md:hidden",
          isDark ? "border-t border-white/10 bg-[#0B0F19]" : "border-t border-black/[0.06] bg-white",
          mobileOpen ? "max-h-[26rem] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <nav
          className={cn(
            "flex flex-col gap-1 px-6 py-4 text-sm font-medium",
            isDark ? "text-zinc-300" : "text-muted-foreground",
          )}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "rounded-md px-2 py-2.5 transition-colors",
                isDark
                  ? location.pathname === link.href
                    ? "bg-white/10 text-white"
                    : "hover:bg-white/5 hover:text-white"
                  : location.pathname === link.href
                    ? "text-foreground font-semibold"
                    : "hover:bg-accent hover:text-foreground",
              )}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className={cn("my-2 h-px", isDark ? "bg-white/10" : "bg-[#E2E8F0]")} />
          <Link
            to="/login"
            className={cn(
              "rounded-md px-2 py-2.5 transition-colors",
              isDark
                ? active === "login"
                  ? "bg-white/10 text-white"
                  : "hover:bg-white/5 hover:text-white"
                : active === "login"
                  ? "text-foreground font-semibold"
                  : "hover:bg-accent hover:text-foreground",
            )}
            onClick={() => setMobileOpen(false)}
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="mt-1 rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 px-2 py-2.5 text-center font-medium text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]"
            onClick={() => setMobileOpen(false)}
          >
            Start Free Trial
          </Link>
        </nav>
      </div>
    </header>
  );
}
