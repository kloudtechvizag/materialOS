import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Bot,
  X,
  Send,
  CheckCircle2,
  Loader2,
  ArrowRight,
  TrendingUp,
  Boxes,
  ShieldCheck,
  Building2,
  Pill,
  Printer,
  FlaskConical,
  GraduationCap,
  Gem,
  Database,
  Zap,
} from "lucide-react";
import { useAiCopilotStore } from "@/store/aiCopilot";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

interface ActionCardData {
  id: string;
  type: "receivables" | "rebalance" | "compliance";
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: "red" | "purple" | "yellow";
  metrics: { label: string; value: string }[];
  actionLabel: string;
  actionRoute: string;
}

interface ReasoningStep {
  text: string;
  status: "pending" | "running" | "completed";
}

interface ChatMessage {
  id: string;
  sender: "user" | "copilot";
  timestamp: string;
  text?: string;
  reasoningSteps?: ReasoningStep[];
  isThinking?: boolean;
  actionCard?: ActionCardData;
}

const STARTER_PROMPTS = [
  {
    label: "Gross Margin Leakage Audit",
    icon: TrendingUp,
    prompt: "Audit active sales orders for gross margin leakages and unexpected discount overrides.",
    cardType: "receivables" as const,
  },
  {
    label: "Batch FEFO Expiry Risk",
    icon: ShieldCheck,
    prompt: "Scan warehouse inventory for high-value batches expiring within 30 days.",
    cardType: "compliance" as const,
  },
  {
    label: "Inter-Godown Stock Rebalance",
    icon: Boxes,
    prompt: "Analyze stockout risks across godowns and suggest instant rebalancing transfers.",
    cardType: "rebalance" as const,
  },
  {
    label: "Statutory GST IRN Audit",
    icon: Zap,
    prompt: "Verify pending vehicle dispatches for mandatory GST E-Way bill IRN generation.",
    cardType: "compliance" as const,
  },
];

const INDUSTRY_PROFILE_MAP: Record<string, { name: string; icon: React.ComponentType<{ className?: string }> }> = {
  building_materials: { name: "Building Materials & Steel", icon: Building2 },
  pharmacy: { name: "Pharmacy & Healthcare FEFO", icon: Pill },
  printing_press: { name: "Printing Press & Digital Lab", icon: Printer },
  laboratory: { name: "Laboratory & LIMS", icon: FlaskConical },
  school_erp: { name: "School & Academy ERP", icon: GraduationCap },
  jewellery: { name: "Jewellery & Bullion", icon: Gem },
  construction_contractor: { name: "Civil & Building Contractor", icon: Building2 },
};

export function AiCopilotHud() {
  const navigate = useNavigate();
  const isOpen = useAiCopilotStore((s) => s.isOpen);
  const closeCopilot = useAiCopilotStore((s) => s.closeCopilot);
  const toggleCopilot = useAiCopilotStore((s) => s.toggleCopilot);
  const activePrompt = useAiCopilotStore((s) => s.activePrompt);
  const setActivePrompt = useAiCopilotStore((s) => s.setActivePrompt);

  const tenantSlug = useAuthStore((s) => s.tenantSlug);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "copilot",
      timestamp: "Just now",
      text: `Hello! I am your MaterialOS AI Copilot. Connected to workspace **${tenantSlug || "default"}**. How can I assist your team today?`,
    },
  ]);

  const [isProcessing, setIsProcessing] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Global Ctrl+J / Cmd+J keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggleCopilot();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCopilot]);

  // Handle auto-dispatch when activePrompt is updated programmatically
  useEffect(() => {
    if (isOpen && activePrompt) {
      handleSendPrompt(activePrompt);
      setActivePrompt("");
    }
  }, [isOpen, activePrompt]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isProcessing]);

  function handleSendPrompt(promptText: string) {
    if (!promptText.trim() || isProcessing) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: promptText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsProcessing(true);

    const copilotMsgId = `copilot-${Date.now()}`;

    // Multi-Step Execution Trace simulation
    const steps: ReasoningStep[] = [
      { text: "Querying multi-tenant database & ledger tables...", status: "running" },
      { text: "Cross-referencing real-time inventory balances and credit limits...", status: "pending" },
      { text: "Synthesizing actionable recommendations...", status: "pending" },
    ];

    const initialCopilotMsg: ChatMessage = {
      id: copilotMsgId,
      sender: "copilot",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isThinking: true,
      reasoningSteps: steps,
    };

    setMessages((prev) => [...prev, initialCopilotMsg]);

    // Step 1 -> Step 2
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === copilotMsgId) {
            return {
              ...msg,
              reasoningSteps: [
                { text: "Querying multi-tenant database & ledger tables...", status: "completed" },
                { text: "Cross-referencing real-time inventory balances and credit limits...", status: "running" },
                { text: "Synthesizing actionable recommendations...", status: "pending" },
              ],
            };
          }
          return msg;
        })
      );
    }, 900);

    // Step 2 -> Step 3
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === copilotMsgId) {
            return {
              ...msg,
              reasoningSteps: [
                { text: "Querying multi-tenant database & ledger tables...", status: "completed" },
                { text: "Cross-referencing real-time inventory balances and credit limits...", status: "completed" },
                { text: "Synthesizing actionable recommendations...", status: "running" },
              ],
            };
          }
          return msg;
        })
      );
    }, 1800);

    // Final Completion with Action Card
    setTimeout(() => {
      const cardType = determineActionCardType(promptText);
      const actionCard = getActionCardData(cardType);

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === copilotMsgId) {
            return {
              ...msg,
              isThinking: false,
              reasoningSteps: [
                { text: "Querying multi-tenant database & ledger tables...", status: "completed" },
                { text: "Cross-referencing real-time inventory balances and credit limits...", status: "completed" },
                { text: "Synthesizing actionable recommendations...", status: "completed" },
              ],
              text: `Analysis complete for workspace **${tenantSlug || "default"}**. I have surfaced 1 priority action card requiring immediate operator attention:`,
              actionCard,
            };
          }
          return msg;
        })
      );
      setIsProcessing(false);
    }, 2700);
  }

  function determineActionCardType(prompt: string): "receivables" | "rebalance" | "compliance" {
    const lower = prompt.toLowerCase();
    if (lower.includes("stock") || lower.includes("rebalance") || lower.includes("godown") || lower.includes("transfer")) {
      return "rebalance";
    }
    if (lower.includes("gst") || lower.includes("irn") || lower.includes("fefo") || lower.includes("compliance") || lower.includes("dispatch")) {
      return "compliance";
    }
    return "receivables";
  }

  function getActionCardData(type: "receivables" | "rebalance" | "compliance"): ActionCardData {
    if (type === "receivables") {
      return {
        id: "card-receivables",
        type: "receivables",
        title: "🔴 Overdue Receivables Alert",
        subtitle: "3 Dealer Accounts exceeded 46+ days credit term limit. Total overdue ₹18.40 Lakh.",
        badge: "High Credit Risk",
        badgeColor: "red",
        metrics: [
          { label: "Total Overdue", value: "₹18.40 Lakh" },
          { label: "Accounts Flagged", value: "3 Dealers" },
          { label: "Max Overdue", value: "58 Days" },
        ],
        actionLabel: "Jump to Collections Workspace",
        actionRoute: "/collections?tab=46+",
      };
    }
    if (type === "rebalance") {
      return {
        id: "card-rebalance",
        type: "rebalance",
        title: "🟣 Inter-Godown Rebalancing Suggested",
        subtitle: "Visakhapatnam Godown stock is at 94% capacity while Vijayawada Godown faces TMT rebar stockout.",
        badge: "Stockout Risk Avoidance",
        badgeColor: "purple",
        metrics: [
          { label: "Suggested Transfer", value: "15.0 MT TMT" },
          { label: "Origin", value: "Vizag Godown" },
          { label: "Destination", value: "Vijayawada Yard" },
        ],
        actionLabel: "Create Transfer Order (1-Click)",
        actionRoute: "/transfers",
      };
    }
    return {
      id: "card-compliance",
      type: "compliance",
      title: "🟡 GST & E-Way Bill Dispatch Compliance",
      subtitle: "2 Dispatches queued for vehicle gate-out missing mandatory IRN generation.",
      badge: "Gate-Out Audit Failure",
      badgeColor: "yellow",
      metrics: [
        { label: "Pending Vehicles", value: "2 Trucks" },
        { label: "Total Consignment", value: "₹4.12 Lakh" },
        { label: "IRN Status", value: "Missing" },
      ],
      actionLabel: "Open Dispatch Compliance Board",
      actionRoute: "/dispatch/board",
    };
  }

  if (!isOpen) return null;

  // Resolve Industry Profile display
  const matchedIndustryKey = Object.keys(INDUSTRY_PROFILE_MAP)[0];
  const IndustryIcon = INDUSTRY_PROFILE_MAP[matchedIndustryKey].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      {/* Outer Floating Modal Glass Container */}
      <div className="relative flex h-[85vh] max-h-[720px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0A0E1A]/95 text-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
        {/* Subtle Ambient Radial Aurora */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-violet-600/20 blur-[90px]" />
        <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-600/15 blur-[90px]" />

        {/* Modal Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.5)]">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">AI Copilot Autonomous HUD</h3>
                <span className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-ping" />
                  v2.0 Autonomous
                </span>
              </div>
              <p className="flex items-center gap-2 text-xs text-zinc-400">
                <span>Active Workspace: <strong className="text-zinc-200">{tenantSlug || "default"}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1 text-violet-300">
                  <IndustryIcon className="h-3 w-3" />
                  {INDUSTRY_PROFILE_MAP[matchedIndustryKey].name}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-zinc-400">
              Esc to close
            </kbd>
            <button
              onClick={closeCopilot}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Starter Pills Bar */}
        <div className="relative z-10 flex items-center gap-2 overflow-x-auto border-b border-white/10 bg-black/40 px-6 py-2.5 no-scrollbar">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 shrink-0 flex items-center gap-1">
            <Zap className="h-3 w-3 text-violet-400" /> Starters:
          </span>
          {STARTER_PROMPTS.map((sp, idx) => {
            const Icon = sp.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSendPrompt(sp.prompt)}
                disabled={isProcessing}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 hover:border-violet-500/40 hover:bg-violet-600/20 hover:text-white transition-all duration-150 disabled:opacity-50"
              >
                <Icon className="h-3 w-3 text-violet-400" />
                <span>{sp.label}</span>
              </button>
            );
          })}
        </div>

        {/* Chat Messages Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-3.5", msg.sender === "user" ? "justify-end" : "justify-start")}>
              {msg.sender === "copilot" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-950/60 text-violet-300">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div className={cn("max-w-[85%] space-y-3", msg.sender === "user" ? "items-end" : "items-start")}>
                {/* Text Bubble */}
                {msg.text && (
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      msg.sender === "user"
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md rounded-tr-none"
                        : "border border-white/10 bg-white/[0.04] text-zinc-200 rounded-tl-none"
                    )}
                  >
                    {msg.text}
                  </div>
                )}

                {/* Real-time Multi-step Execution Trace */}
                {msg.reasoningSteps && (
                  <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-violet-300 uppercase tracking-wider">
                      <Database className="h-3.5 w-3.5 text-violet-400 animate-spin" />
                      <span>Autonomous Reasoning Trace</span>
                    </div>

                    <div className="space-y-2">
                      {msg.reasoningSteps.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-2.5 text-xs">
                          {step.status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          ) : step.status === "running" ? (
                            <Loader2 className="h-4 w-4 text-violet-400 animate-spin shrink-0" />
                          ) : (
                            <span className="h-4 w-4 rounded-full border border-white/20 shrink-0" />
                          )}
                          <span
                            className={cn(
                              step.status === "completed"
                                ? "text-zinc-300 font-medium"
                                : step.status === "running"
                                ? "text-violet-300 font-semibold"
                                : "text-zinc-500"
                            )}
                          >
                            {step.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Action Card */}
                {msg.actionCard && (
                  <div className="overflow-hidden rounded-xl border border-white/15 bg-white/[0.03] shadow-lg transition-all hover:border-violet-500/40">
                    <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-3">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {msg.actionCard.title}
                      </h4>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          msg.actionCard.badgeColor === "red"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : msg.actionCard.badgeColor === "purple"
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        )}
                      >
                        {msg.actionCard.badge}
                      </span>
                    </div>

                    <div className="p-4 space-y-3">
                      <p className="text-xs text-zinc-300 leading-normal">{msg.actionCard.subtitle}</p>

                      <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-black/40 p-2.5">
                        {msg.actionCard.metrics.map((m, mIdx) => (
                          <div key={mIdx} className="text-center">
                            <span className="text-[10px] text-zinc-400 block">{m.label}</span>
                            <span className="text-xs font-bold text-white">{m.value}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          closeCopilot();
                          navigate(msg.actionCard!.actionRoute);
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-violet-500 transition-colors"
                      >
                        <span>{msg.actionCard.actionLabel}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {msg.sender === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white font-bold text-xs">
                  ME
                </div>
              )}
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>

        {/* Footer Input Bar */}
        <div className="relative z-10 border-t border-white/10 bg-black/50 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt(input);
            }}
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] p-2 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/50"
          >
            <Sparkles className="ml-2 h-4 w-4 text-violet-400 shrink-0" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AI Copilot to run audits, suggest transfers, or check receivables..."
              className="flex-1 bg-transparent px-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)]"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
