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
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
          {item.href ? (
            <Link to={item.href} className="hover:text-foreground hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
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
