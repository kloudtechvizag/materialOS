import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Zap,
  Lock,
  Database,
  Building2,
  CheckCircle2,
  Cpu,
  Layers,
} from "lucide-react";

import { MarketingHeader, type AuthAction } from "@/components/marketing/MarketingHeader";

const LIVE_EVENTS = [
  { id: 1, text: "SO-2026-00492 credit limit auto-cleared (₹2,45,000)", latency: "4ms", time: "just now", status: "success" },
  { id: 2, text: "Dual-UOM stock signed: 12mm TMT Steel (12.4 MT)", latency: "2ms", time: "12s ago", status: "success" },
  { id: 3, text: "E-Way Bill AP-DL-9821 auto-generated with IRN", latency: "6ms", time: "34s ago", status: "success" },
  { id: 4, text: "FEFO Batch #B-9021 auto-allocated before expiry", latency: "3ms", time: "1m ago", status: "success" },
  { id: 5, text: "POS Counter split payment settled: Cash ₹450 + UPI ₹1,200", latency: "5ms", time: "2m ago", status: "success" },
];

const PREVIEW_PROFILES = [
  { name: "Building Materials", desc: "Dual-UOM piece & kg weight + contractor credit limits", icon: Building2 },
  { name: "Retail & FMCG", desc: "Sub-second barcode POS with split Cash/UPI payments", icon: Zap },
  { name: "Pharmacy", desc: "Batch & expiry tracking with automatic FEFO picking", icon: ShieldCheck },
];

export function AuthLayout({ children, active }: { children: React.ReactNode; active?: AuthAction }) {
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentEventIndex((prev) => (prev + 1) % LIVE_EVENTS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <MarketingHeader active={active} theme="dark" />

      <div className="relative flex flex-1 overflow-hidden">
        {/* Ambient Aurora Glows */}
        <div className="pointer-events-none absolute -left-40 top-1/4 h-[650px] w-[650px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.22)_0%,rgba(59,130,246,0.1)_45%,transparent_75%)] blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 -bottom-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18)_0%,rgba(16,185,129,0.08)_45%,transparent_75%)] blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
          aria-hidden="true"
        />

        {/* Left Side: Enterprise Platform Showcase & Telemetry HUD */}
        <div className="relative hidden w-[48%] shrink-0 flex-col justify-between border-r border-white/10 bg-[#070B14]/80 p-10 backdrop-blur-xl lg:flex xl:p-14 z-10">
          {/* Top: Telemetry & Region Ping */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              <span className="font-mono">Node: ap-south-1 (Mumbai)</span>
              <span className="text-zinc-500">•</span>
              <span className="text-emerald-400 font-semibold">99.99% Core Uptime</span>
            </div>

            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white xl:text-4xl">
                The single system of record for{" "}
                <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
                  modern Indian trade.
                </span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                Inventory ledgers, customer credit controls, GST e-invoicing, warehouse dispatch, and counter POS -- united in one real-time transaction engine.
              </p>
            </div>

            {/* Live Ledger Activity Simulator */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl shadow-[0_15px_30px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5 text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-violet-400" />
                  Live Platform Telemetry
                </span>
                <span className="text-emerald-400">Sub-5ms Execution</span>
              </div>
              <div className="mt-3 space-y-2">
                {LIVE_EVENTS.map((event, idx) => {
                  const isCurrent = idx === currentEventIndex;
                  return (
                    <div
                      key={event.id}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all duration-300 ${
                        isCurrent
                          ? "border border-violet-500/40 bg-violet-500/10 text-white shadow-[0_0_15px_rgba(124,58,237,0.2)]"
                          : "text-zinc-400 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`h-1.5 w-1.5 rounded-full ${isCurrent ? "bg-emerald-400 animate-ping" : "bg-zinc-600"}`} />
                        <span className="truncate font-mono">{event.text}</span>
                      </div>
                      <span className="font-mono text-[10px] text-zinc-500 shrink-0 ml-2">{event.latency}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Multi-Industry Profiles Showcase */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-violet-400" />
                Adaptive Industry Operating Profiles
              </span>
              <div className="grid gap-2 sm:grid-cols-3">
                {PREVIEW_PROFILES.map((prof) => {
                  const Icon = prof.icon;
                  return (
                    <div
                      key={prof.name}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md transition-all hover:border-violet-500/40 hover:bg-white/[0.06]"
                    >
                      <Icon className="h-4 w-4 text-violet-400" />
                      <h4 className="mt-2 text-xs font-bold text-white">{prof.name}</h4>
                      <p className="mt-1 text-[11px] leading-tight text-zinc-400">{prof.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom: Trust & Security Badges */}
          <div className="border-t border-white/10 pt-6">
            <div className="grid grid-cols-2 gap-3 text-[11px] text-zinc-400 sm:grid-cols-4 font-mono">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>SOC2 Type II</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-violet-400" />
                <span>256-Bit TLS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-sky-400" />
                <span>RLS Isolation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
                <span>GST E-Invoice</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form Container */}
        <div className="relative flex flex-1 items-center justify-center p-6 md:p-12 z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
