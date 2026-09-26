import { useState } from "react";
import {
  AlertCircle,
  FileText,
  Printer,
  Sparkles,
  Command,
  ArrowRightLeft,
  CheckCircle2,
  QrCode,
  Download,
  Building,
  Layers,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function BentoGridFeatures() {
  const [thermalPaperWidth, setThermalPaperWidth] = useState<58 | 80>(80);
  const [activeCopilotQuery, setActiveCopilotQuery] = useState(
    "Show me invoices aging > 45 days with unapproved credit limits"
  );

  return (
    <section className="relative bg-[#070B14] py-20 text-white">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
            <Layers className="h-3 w-3" />
            <span>Architecture & Capabilities</span>
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Engineered as an{" "}
            <span className="bg-gradient-to-r from-violet-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
              Actionable Operating System
            </span>
          </h2>
          <p className="mt-4 text-base text-zinc-400 sm:text-lg">
            Every screen answers: What is happening? What needs my attention? What can I do right now? And what should I do next?
          </p>
        </div>

        {/* 6-Card Bento Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* CARD 1: Real-Time Attention Center */}
          <div className="group relative rounded-2xl border border-white/10 bg-[#0B0F19] p-6 transition-all duration-300 hover:border-violet-500/40 hover:bg-[#0E1424] lg:col-span-2">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-rose-500/20 p-2 text-rose-400">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Real-Time Attention Center</h3>
                  <p className="text-xs text-zinc-400">Never let bottlenecks silently leak cash or stall customer orders</p>
                </div>
              </div>
              <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-300 animate-pulse">
                3 Active Exceptions
              </span>
            </div>

            {/* Severity Alert Stack */}
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                  <span className="font-semibold text-rose-200">🔴 Critical Negative Stock:</span>
                  <span className="text-zinc-300">JSW 12mm TMT is -1,200 kg in Godown 2 after urgent dispatch</span>
                </div>
                <button className="shrink-0 rounded-md bg-rose-500/30 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/50">
                  Rebalance Now
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-semibold text-amber-200">🟠 Unapproved Advance:</span>
                  <span className="text-zinc-300">Staff salary advance ₹15,000 for driver Ramesh requires supervisor signoff</span>
                </div>
                <button className="shrink-0 rounded-md bg-amber-500/30 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/50">
                  Approve / Reject
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
                  <span className="font-semibold text-sky-200">🟡 Overdue TAT Alert:</span>
                  <span className="text-zinc-300">Batch testing worksheet #WS-204 exceeds 4h target turn-around time</span>
                </div>
                <button className="shrink-0 rounded-md bg-sky-500/30 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/50">
                  Inspect Lab
                </button>
              </div>
            </div>
          </div>

          {/* CARD 2: Unified Tax & Statutory Engine */}
          <div className="group rounded-2xl border border-white/10 bg-[#0B0F19] p-6 transition-all duration-300 hover:border-violet-500/40 hover:bg-[#0E1424]">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Statutory & GST Engine</h3>
                <p className="text-xs text-zinc-400">Built for Indian tax compliance (2026)</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 1-Click E-Invoicing (IRN)
                  </span>
                  <span className="text-[10px] rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300 font-mono">NIC Live</span>
                </div>
                <p className="mt-1 text-zinc-400 text-[11px]">Direct integration with govt portal with QR code signed response</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Automated E-Way Bill
                  </span>
                  <span className="text-[10px] rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300 font-mono">Vehicle Sync</span>
                </div>
                <p className="mt-1 text-zinc-400 text-[11px]">Auto-generates Part A & Part B on vehicle assignment</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Download className="h-4 w-4 text-sky-400" /> Tally XML Export
                  </span>
                  <span className="text-[10px] rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-300 font-mono">Zero Lock-in</span>
                </div>
                <p className="mt-1 text-zinc-400 text-[11px]">Instant export vouchers for your CA to import directly into Tally</p>
              </div>
            </div>
          </div>

          {/* CARD 3: Physical Document & Receipt Studio */}
          <div className="group rounded-2xl border border-white/10 bg-[#0B0F19] p-6 transition-all duration-300 hover:border-violet-500/40 hover:bg-[#0E1424]">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-sky-500/20 p-2 text-sky-400">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Universal Receipt Studio</h3>
                  <p className="text-xs text-zinc-400">Thermal receipts, tax invoices & challans</p>
                </div>
              </div>
              <div className="flex rounded-md border border-white/15 bg-black/40 p-0.5 text-[11px]">
                <button
                  onClick={() => setThermalPaperWidth(58)}
                  className={cn("px-2 py-0.5 rounded", thermalPaperWidth === 58 ? "bg-violet-600 text-white" : "text-zinc-400")}
                >
                  58mm
                </button>
                <button
                  onClick={() => setThermalPaperWidth(80)}
                  className={cn("px-2 py-0.5 rounded", thermalPaperWidth === 80 ? "bg-violet-600 text-white" : "text-zinc-400")}
                >
                  80mm
                </button>
              </div>
            </div>

            {/* Receipt Simulated View */}
            <div className="mt-5 mx-auto max-w-[240px] rounded-lg bg-white p-3 text-black font-mono text-[10px] shadow-md border border-zinc-200">
              <div className="text-center font-bold text-xs uppercase">SRI BALAJI ENTERPRISES</div>
              <div className="text-center text-[9px] text-zinc-600">GSTIN: 37AASCS1234F1Z5</div>
              <div className="border-t border-dashed border-zinc-400 my-1.5" />
              <div className="flex justify-between">
                <span>Inv: #INV-2026-904</span>
                <span>26-Sep-2026</span>
              </div>
              <div className="border-t border-dashed border-zinc-400 my-1.5" />
              <div className="flex justify-between font-bold">
                <span>TMT 12mm Fe500D (1.2T)</span>
                <span>₹75,600</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>CGST+SGST (18%)</span>
                <span>₹13,608</span>
              </div>
              <div className="border-t border-zinc-900 my-1" />
              <div className="flex justify-between font-bold text-xs">
                <span>TOTAL:</span>
                <span>₹89,208</span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5 bg-zinc-100 p-1 rounded">
                <QrCode className="h-6 w-6 text-black" />
                <span className="text-[8px] font-sans font-medium text-zinc-700">Scan & Pay via UPI</span>
              </div>
            </div>
          </div>

          {/* CARD 4: Action-First Workspaces */}
          <div className="group rounded-2xl border border-white/10 bg-[#0B0F19] p-6 transition-all duration-300 hover:border-violet-500/40 hover:bg-[#0E1424]">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <div className="rounded-lg bg-violet-500/20 p-2 text-violet-400">
                <Command className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Keyboard-First Velocity</h3>
                <p className="text-xs text-zinc-400">Navigate at 100 words per minute</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
                <span className="text-zinc-300">Universal Command Palette</span>
                <kbd className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-mono text-zinc-300">
                  Ctrl + K
                </kbd>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
                <span className="text-zinc-300">Instant Quick Create Item/Quote</span>
                <kbd className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-mono text-zinc-300">
                  C then I
                </kbd>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
                <span className="text-zinc-300">Row Hover Actions</span>
                <span className="text-[11px] text-violet-400 font-medium">Zero page-reloads</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
                <span className="text-zinc-300">Slide-Out 360 Detail Drawer</span>
                <span className="text-[11px] text-emerald-400 font-medium">Keep your context</span>
              </div>
            </div>
          </div>

          {/* CARD 5: Multi-Branch & Godown Synchronization */}
          <div className="group rounded-2xl border border-white/10 bg-[#0B0F19] p-6 transition-all duration-300 hover:border-violet-500/40 hover:bg-[#0E1424]">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-400">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Multi-Branch Rebalancing</h3>
                <p className="text-xs text-zinc-400">Real-time stock transfers & fleet routing</p>
              </div>
            </div>

            <div className="mt-5 space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-violet-400" />
                  <span className="font-semibold text-white">Central Godown</span>
                </div>
                <span className="text-xs text-zinc-400">Transfer #TR-4021</span>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-sky-400" />
                  <span className="font-semibold text-white">City Branch</span>
                </div>
              </div>

              {/* Progress bar of payload */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Truck AP-31-TE-1049 (Tata 407)</span>
                  <span className="text-emerald-400 font-medium">85% Payload</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-emerald-400 rounded-full w-[85%]" />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11px] text-zinc-400">
                <span className="text-white font-medium block">Automatic In-Transit Ledgering:</span>
                Stock is decremented from source and marked &quot;In Transit&quot; until driver scans QR arrival badge.
              </div>
            </div>
          </div>

          {/* CARD 6: Embedded AI Copilot */}
          <div className="group rounded-2xl border border-white/10 bg-[#0B0F19] p-6 transition-all duration-300 hover:border-violet-500/40 hover:bg-[#0E1424] lg:col-span-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 p-2 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Embedded AI Business Copilot</h3>
                  <p className="text-xs text-zinc-400">Ask in plain English — MaterialOS generates real-time operational audits and triggers actions</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-300 font-medium">
                <span className="h-2 w-2 rounded-full bg-violet-400 animate-ping" />
                <span>AI Agent Ready</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              {/* Query Input simulation */}
              <div className="lg:col-span-1 space-y-3">
                <label className="text-xs text-zinc-400">Natural Language Prompt:</label>
                <div className="flex items-center gap-2 rounded-xl border border-violet-500/40 bg-white/[0.03] p-3 text-xs text-white">
                  <Search className="h-4 w-4 text-violet-400 shrink-0" />
                  <span className="font-mono text-zinc-200 text-[11px]">{activeCopilotQuery}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setActiveCopilotQuery("Show me all negative stock situations across warehouses");
                    }}
                    className="text-[10px] rounded-md border border-white/10 bg-white/5 px-2 py-1 text-zinc-400 hover:text-white"
                  >
                    Try: Negative stock
                  </button>
                  <button
                    onClick={() => {
                      setActiveCopilotQuery("Audit top 5 overdue receivables with collection probability");
                    }}
                    className="text-[10px] rounded-md border border-white/10 bg-white/5 px-2 py-1 text-zinc-400 hover:text-white"
                  >
                    Try: Overdue receivables
                  </button>
                </div>
              </div>

              {/* Actionable Resolution Card Output */}
              <div className="lg:col-span-2 rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                    Copilot Finding: 2 Customer Accounts Exceeding 45-Day Threshold
                  </span>
                  <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] text-violet-300 font-medium">
                    Analysis in 42ms
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                    <div className="flex justify-between font-medium text-white">
                      <span>Sri Balaji Infra Ltd</span>
                      <span className="text-rose-400">₹3,42,000</span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">Age: 52 days · Limit: ₹2,50,000 (Exceeded by ₹92k)</p>
                    <button className="mt-2.5 w-full rounded bg-rose-500/20 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/30">
                      Hold Future Dispatches
                    </button>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                    <div className="flex justify-between font-medium text-white">
                      <span>Apex Constructions</span>
                      <span className="text-amber-400">₹1,85,000</span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">Age: 48 days · Limit: ₹2,00,000 (At 92% capacity)</p>
                    <button className="mt-2.5 w-full rounded bg-amber-500/20 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/30">
                      Send WhatsApp Statement
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
