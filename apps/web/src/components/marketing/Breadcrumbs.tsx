import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { SITE_URL } from "./Seo";

export interface BreadcrumbItem {
  label: string;
  href?: string; // omitted on the current (last) item
}

/** Visible breadcrumb trail + matching BreadcrumbList JSON-LD (§117) --
 * pass the returned jsonLd into <Seo jsonLd={...}>. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-zinc-400">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />}
          {item.href ? (
            <Link
              to={item.href}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-zinc-400 backdrop-blur-md transition-colors hover:border-violet-500/40 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ) : (
            <span className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 font-semibold text-violet-300 backdrop-blur-md">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function breadcrumbJsonLd(items: BreadcrumbItem[], currentPath: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: item.href ? `${SITE_URL}${item.href}` : `${SITE_URL}${currentPath}`,
    })),
  };
}
