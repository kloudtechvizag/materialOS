import { Link } from "react-router-dom";

import { MarketingHeader } from "@/components/marketing/MarketingHeader";

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
  return (
    <div className="flex min-h-screen flex-col bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <MarketingHeader theme="dark" />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10 bg-[#04070E] text-zinc-400 transition-colors">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/brand/symbol.svg" alt="" className="h-8 w-8" />
              <span className="text-lg font-bold tracking-tight text-white">
                Material<span className="bg-gradient-to-r from-violet-400 to-sky-400 bg-clip-text text-transparent">OS</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-zinc-400">
              The intelligent business operating system unifying operations across 26 modern industries.
            </p>
          </div>
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-white">
                {section.title}
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 px-6 py-4 text-center text-xs text-zinc-500">
          &copy; {new Date().getFullYear()} MaterialOS Inc. All rights reserved. • ISO 27001 & SOC 2 Type II Certified
        </div>
      </footer>
    </div>
  );
}
