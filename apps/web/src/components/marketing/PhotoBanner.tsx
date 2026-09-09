/** A real, specific, relevant photo (apps/web/public/photos/*.webp,
 * sourced from Unsplash -- License: free for commercial/noncommercial
 * use, no permission or attribution required) used only where
 * photography genuinely fits the content (industry pages showing a
 * real warehouse/shelf/press), never as generic filler for abstract
 * software concepts. */
export function PhotoBanner({ src, alt, credit }: { src: string; alt: string; credit: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#E2E8F0] shadow-sm">
      <img src={src} alt={alt} className="aspect-[21/9] w-full object-cover" loading="lazy" />
      <span className="absolute bottom-2 right-3 rounded bg-black/40 px-2 py-0.5 text-[11px] text-white/90">{credit}</span>
    </div>
  );
}
