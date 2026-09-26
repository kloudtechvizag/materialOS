/** Wraps a real MaterialOS product screenshot (apps/web/public/screenshots/*,
 * captured from the actual running app against the sribalaji-demo tenant --
 * never a mockup or fabricated UI) in a browser-chrome card. */
export function BrowserFrame({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F19]/90 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl ${className}`}>
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 px-3 py-0.5 text-[11px] font-mono text-zinc-400">
          app.materialos.com
        </div>
        <div className="w-8" />
      </div>
      <img src={src} alt={alt} className="w-full opacity-95 transition-opacity duration-300 hover:opacity-100" loading="lazy" width={1600} height={1000} />
    </div>
  );
}
