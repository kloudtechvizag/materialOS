import { Link, useLocation } from "react-router-dom";

import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { cn } from "@/lib/utils";

const FOOTER_SECTIONS = [
  {
    title: "Product",
    links: [
      { label: "Product overview", href: "/product" },
      { label: "Industries", href: "/industries" },
      { label: "Features", href: "/features" },
      { label: "Why MaterialOS", href: "/why-materialos" },
      { label: "Compare", href: "/compare" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Book a demo", href: "/book-demo" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Start free", href: "/signup" },
    ],
  },
];

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isDark = location.pathname === "/" || location.pathname === "/pricing";

  return (
    <div className={cn("flex min-h-screen flex-col", isDark ? "bg-[#070B14] text-white" : "bg-white")}>
      <MarketingHeader theme={isDark ? "dark" : "light"} />

      <main className="flex-1">{children}</main>

      <footer
        className={cn(
          "transition-colors",
          isDark ? "border-t border-white/10 bg-[#04070E] text-zinc-400" : "border-t border-[#E2E8F0] bg-[#F8FAFC]",
        )}
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <img src="/brand/symbol.svg" alt="" className="h-8 w-8" />
              <span className={cn("text-lg font-bold tracking-tight", isDark ? "text-white" : "text-foreground")}>
                Material<span className="text-violet-400">OS</span>
              </span>
            </div>
            <p className={cn("mt-3 max-w-xs text-sm", isDark ? "text-zinc-400" : "text-muted-foreground")}>
              The intelligent business operating system for 26 modern industries.
            </p>
          </div>
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className={cn("text-sm font-semibold", isDark ? "text-white" : "text-foreground")}>
                {section.title}
              </h3>
              <ul className={cn("mt-3 space-y-2 text-sm", isDark ? "text-zinc-400" : "text-muted-foreground")}>
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className={cn(
                        "transition-colors",
                        isDark ? "hover:text-white" : "hover:text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          className={cn(
            "border-t px-6 py-4 text-center text-xs",
            isDark ? "border-white/10 text-zinc-500" : "border-[#E2E8F0] text-muted-foreground",
          )}
        >
          &copy; {new Date().getFullYear()} MaterialOS Inc. All rights reserved. • ISO 27001 & SOC 2 Type II Certified
        </div>
      </footer>
    </div>
  );
}
