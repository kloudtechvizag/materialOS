import { BarChart3, Bot, Layers, Package, Truck, Warehouse } from "lucide-react";

import { MarketingHeader, type AuthAction } from "@/components/marketing/MarketingHeader";

const NODES = [
  { id: "cement", label: "Cement", icon: Package, top: "18%", left: "8%" },
  { id: "steel", label: "Steel TMT", icon: Layers, top: "40%", left: "32%" },
  { id: "warehouse", label: "Warehouse", icon: Warehouse, top: "20%", left: "58%" },
  { id: "finance", label: "Finance", icon: BarChart3, top: "62%", left: "62%" },
  { id: "dispatch", label: "AI Dispatch", icon: Bot, top: "44%", left: "88%" },
  { id: "delivery", label: "Delivery", icon: Truck, top: "78%", left: "20%" },
] as const;

const LINKS: [(typeof NODES)[number]["id"], (typeof NODES)[number]["id"]][] = [
  ["cement", "steel"],
  ["steel", "warehouse"],
  ["warehouse", "finance"],
  ["warehouse", "dispatch"],
  ["steel", "delivery"],
];

const MODULES = ["Sales", "Inventory", "Finance", "Operations", "AI"];

function byId(id: string) {
  return NODES.find((n) => n.id === id)!;
}

/** Coded in place of a flat exported image so it always matches the live
 * brand palette and never drifts the way a baked PNG did. Kept
 * deliberately restrained (thin lines, low glow, one pulsing link) --
 * this is brand texture behind a sign-in form, not a dashboard. */
function NodeNetwork() {
  return (
    <div className="relative hidden h-64 w-full max-w-md lg:block">
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
        {/* One quiet pulse of "data movement" along the busiest edge --
            everything else on this panel is static. */}
        <circle r={2.5} fill="#A78BFA">
          <animateMotion
            dur="4s"
            repeatCount="indefinite"
            path={`M ${byId("cement").left} ${byId("cement").top} L ${byId("steel").left} ${byId("steel").top} L ${byId("warehouse").left} ${byId("warehouse").top} L ${byId("dispatch").left} ${byId("dispatch").top}`}
            keyPoints="0;1"
            keyTimes="0;1"
          />
        </circle>
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

/** Shared shell for Login/Signup/Portal login: the same global
 * MarketingHeader as every marketing page on top (so auth pages never
 * feel like a separate app), a branded panel on tablet+ below it
 * (reduced to just a tagline on md, the full node network joins at lg),
 * and the real form on a soft off-white background everywhere. The hero
 * is decorative only -- the functional form is always our own
 * component, never baked into an image. `active` tells MarketingHeader
 * which auth action this page IS, so Login/Signup can show where the
 * visitor already is. */
export function AuthLayout({ children, active }: { children: React.ReactNode; active?: AuthAction }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MarketingHeader active={active} />

      <div className="flex flex-1">
        <div className="relative hidden shrink-0 overflow-hidden bg-[#081426] md:flex md:w-[38%] lg:w-[45%]">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
          />
          <div className="pointer-events-none absolute left-1/3 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-[100px]" />

          <div className="relative flex h-full flex-col justify-center gap-10 p-10 lg:p-12">
            <NodeNetwork />

            <div className="max-w-sm space-y-4">
              <div className="space-y-2">
                <p className="text-xl font-semibold leading-snug text-white">
                  One connected operating system for your business.
                </p>
                <p className="text-sm leading-relaxed text-slate-400">
                  Sales, inventory, purchasing, finance, operations and AI -- connected in one intelligent platform.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {MODULES.map((m, i) => (
                  <span key={m} className="flex items-center text-xs font-medium text-slate-500">
                    {i > 0 && <span className="mr-3 text-slate-700">·</span>}
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center bg-[#F8FAFC] p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
