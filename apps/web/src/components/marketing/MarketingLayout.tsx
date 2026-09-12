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

/** Public marketing chrome -- distinct from AppShell (the authenticated
 * app's sidebar layout). Used by every page under /, /industries/*,
 * /features/*, /about, /contact, /book-demo. */
export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MarketingHeader />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <img src="/brand/symbol.svg" alt="" className="h-8 w-8" />
              <span className="text-lg font-semibold text-foreground">MaterialOS</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">One intelligent operating system for every business.</p>
          </div>
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link to={link.href} className="hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-[#E2E8F0] px-6 py-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} MaterialOS. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
