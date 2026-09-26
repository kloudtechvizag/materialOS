/** A real, specific, relevant photo (apps/web/public/photos/*.webp,
 * sourced from Unsplash -- License: free for commercial/noncommercial
 * use, no permission or attribution required) used only where
 * photography genuinely fits the content (industry pages showing a
 * real warehouse/shelf/press), never as generic filler for abstract
 * software concepts. */
export function PhotoBanner({ src, alt, credit }: { src: string; alt: string; credit: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      <img src={src} alt={alt} className="aspect-[21/9] w-full object-cover brightness-90 hover:brightness-100 transition-all duration-300" loading="lazy" />
      <span className="absolute bottom-3 right-4 rounded-md border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] text-zinc-300 backdrop-blur-md">{credit}</span>
    </div>
  );
}
