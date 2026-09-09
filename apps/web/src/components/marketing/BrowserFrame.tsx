/** Wraps a real MaterialOS product screenshot (apps/web/public/screenshots/*,
 * captured from the actual running app against the sribalaji-demo tenant --
 * never a mockup or fabricated UI) in a browser-chrome card. */
export function BrowserFrame({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xl ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF6B6B]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FFD166]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#06D6A0]" />
      </div>
      <img src={src} alt={alt} className="w-full" loading="lazy" width={1600} height={1000} />
    </div>
  );
}
