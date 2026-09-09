import type { FaqEntry } from "@/marketing/content/types";

/** Renders a real FAQ list. Pass faqJsonLd(faqs) into <Seo jsonLd={...}>
 * -- only called with non-empty, real content (§115, §122: never emit
 * FAQPage schema for content that isn't actually on the page). */
export function Faq({ items }: { items: FaqEntry[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
      <div className="space-y-5">
        {items.map((item) => (
          <div key={item.q}>
            <h3 className="font-medium">{item.q}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function faqJsonLd(items: FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
