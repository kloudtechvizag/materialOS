import { Bot, Layers, Package, Warehouse } from "lucide-react";

const NODES = [
  { id: "cement", label: "Cement", icon: Package, top: "20%", left: "14%" },
  { id: "steel", label: "Steel TMT", icon: Layers, top: "50%", left: "40%" },
  { id: "warehouse", label: "Warehouse", icon: Warehouse, top: "28%", left: "68%" },
  { id: "dispatch", label: "AI Dispatch", icon: Bot, top: "76%", left: "82%" },
] as const;

const LINKS: [(typeof NODES)[number]["id"], (typeof NODES)[number]["id"]][] = [
  ["cement", "steel"],
  ["steel", "warehouse"],
  ["warehouse", "dispatch"],
];

function byId(id: string) {
  return NODES.find((n) => n.id === id)!;
}

/** Coded in place of a flat exported image so it always matches the live
 * brand palette (teal/navy/slate) and never drifts the way a baked PNG
 * did -- the old login-artwork.png was still the previous brand's raw
 * cyan-on-navy wireframe after the mark itself was replaced. */
function NodeNetwork() {
  return (
    <div className="relative h-64 w-full max-w-md">
      <div className="pointer-events-none absolute left-[15%] top-[15%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#028090]/30 blur-3xl" />
      <div className="pointer-events-none absolute left-[80%] top-[70%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#028090]/25 blur-3xl" />
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00A896" />
            <stop offset="100%" stopColor="#2DD4BF" />
          </linearGradient>
          <filter id="linkGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {LINKS.map(([fromId, toId]) => {
          const from = byId(fromId);
          const to = byId(toId);
          return (
            <line
              key={`${fromId}-${toId}`}
              x1={from.left}
              y1={from.top}
              x2={to.left}
              y2={to.top}
              stroke="url(#linkGrad)"
              strokeWidth={1.5}
              opacity={0.7}
              filter="url(#linkGlow)"
            />
          );
        })}
      </svg>
      {NODES.map(({ id, label, icon: Icon, top, left }) => (
        <div
          key={id}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 shadow-[0_0_16px_-4px_rgba(45,212,191,0.5)] backdrop-blur-sm"
          style={{ top, left }}
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-teal-300" />
          <span className="whitespace-nowrap text-xs font-medium text-white/90">{label}</span>
        </div>
      ))}
    </div>
  );
}

/** Shared shell for Login/Signup: a branded panel on wide screens, the
 * real form on top of a plain background everywhere else. The hero is
 * decorative only -- the functional form is always our own component,
 * never baked into an image. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 lg:block">
        <div
          className="absolute inset-0 opacity-40"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />

        <div className="relative flex h-full flex-col items-start justify-between p-10">
          <img src="/brand/logo-dark.svg" alt="MaterialOS" className="h-12 w-auto" />
          <NodeNetwork />
          <p className="max-w-sm text-sm text-slate-400">
            One connected operating system for sales, inventory, accounting, and operations -- configured for
            your industry, from retail and pharmacy to printing and building materials.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-slate-100 p-4">
        {children}
      </div>
    </div>
  );
}
