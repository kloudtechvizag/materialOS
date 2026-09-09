import { Bot, Layers, Package, Warehouse } from "lucide-react";

const NODES = [
  { id: "cement", label: "Cement", icon: Package, top: "22%", left: "10%" },
  { id: "steel", label: "Steel TMT", icon: Layers, top: "46%", left: "36%" },
  { id: "warehouse", label: "Warehouse", icon: Warehouse, top: "30%", left: "64%" },
  { id: "dispatch", label: "AI Dispatch", icon: Bot, top: "58%", left: "90%" },
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
 * brand palette and never drifts the way a baked PNG did. Kept
 * deliberately restrained (thin lines, low glow) -- this is brand
 * texture behind a sign-in form, not a dashboard. */
function NodeNetwork() {
  return (
    <div className="relative hidden h-56 w-full max-w-md lg:block">
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#34D399" stopOpacity={0.7} />
          </linearGradient>
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
              strokeWidth={1}
            />
          );
        })}
      </svg>
      {NODES.map(({ id, label, icon: Icon, top, left }) => (
        <div
          key={id}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 backdrop-blur-sm"
          style={{ top, left }}
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-slate-300" />
          <span className="whitespace-nowrap text-xs font-medium text-slate-200">{label}</span>
        </div>
      ))}
    </div>
  );
}

/** Shared shell for Login/Signup/Portal login: a branded panel on
 * tablet+ (reduced to just logo/tagline on md, the full node network
 * joins at lg), the real form on top of a soft off-white background
 * everywhere. The hero is decorative only -- the functional form is
 * always our own component, never baked into an image. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden shrink-0 overflow-hidden bg-[#081426] md:flex md:w-[38%] lg:w-[45%]">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        />
        <div className="pointer-events-none absolute left-1/3 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-[100px]" />

        <div className="relative flex h-full flex-col justify-between p-10 lg:p-12">
          <img src="/brand/logo-dark.svg" alt="MaterialOS" className="h-10 w-auto" />

          <NodeNetwork />

          <div className="max-w-sm space-y-2">
            <p className="text-xl font-semibold leading-snug text-white">
              One intelligent operating system for every business.
            </p>
            <p className="text-sm leading-relaxed text-slate-400">
              Manage sales, inventory, purchasing, finance, operations and AI from one powerful platform.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[#F8FAFC] p-6">
        {children}
      </div>
    </div>
  );
}
