import { Lock } from "lucide-react";

/** Wraps a real MaterialOS product screenshot (apps/web/public/screenshots/*,
 * captured from the actual running app against the sribalaji-demo tenant --
 * never a mockup or fabricated UI) in a browser-chrome card. */
export function BrowserFrame({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative group rounded-2xl p-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(124,58,237,0.12)] ${className}`}>
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-violet-600/20 to-sky-600/20 blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-500" />
      
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#070B14]/95 backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-[11px] font-mono text-zinc-300 shadow-inner">
            <Lock className="h-3 w-3 text-emerald-400" />
            <span>https://app.materialos.com</span>
          </div>
          <div className="w-10" />
        </div>
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#070B14]">
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover object-top opacity-95 transition-all duration-500 group-hover:opacity-100 group-hover:scale-[1.01]"
            loading="lazy"
            width={1600}
            height={1000}
          />
        </div>
      </div>
    </div>
  );
}
