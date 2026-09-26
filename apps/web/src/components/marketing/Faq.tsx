import type { FaqEntry } from "@/marketing/content/types";

/** Renders a real FAQ list. Pass faqJsonLd(faqs) into <Seo jsonLd={...}>
 * -- only called with non-empty, real content (§115, §122: never emit
 * FAQPage schema for content that isn't actually on the page). */
export function Faq({ items }: { items: FaqEntry[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-white">Frequently Asked Questions</h2>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.q} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md transition-all hover:border-violet-500/30">
            <h3 className="font-semibold text-white">{item.q}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.a}</p>
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
