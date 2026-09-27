import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import {
  Printer,
  Scale,
  Barcode,
  Coins,
  Database,
  Building2,
  Mail,
  ArrowRight,
  Server,
  Zap,
  Sparkles,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { DesktopWindowControls } from "@/components/layout/DesktopWindowControls";
import { apiFetch, ApiError } from "@/lib/api";
import { getApiBase, testServerConnection } from "@/lib/serverConfig";
import { useAuthStore } from "@/store/auth";

const schema = z.object({
  tenantSlug: z.string().min(1, "Workspace slug is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const DEMO_WORKSPACES = [
  {
    title: "Building Materials & Steel",
    category: "Wholesale & Distribution",
    slug: "sribalaji-demo",
    email: "owner@sribalaji-demo.example.com",
    badge: "Dealer ERP",
    desc: "TMT steel, 50-ton dispatch manifests, multi-warehouse stock ledgers & live credit controls.",
    icon: Building2,
    gradient: "from-blue-600/20 to-sky-600/10 border-blue-500/30 text-blue-400",
  },
  {
    title: "Civil & Infrastructure Contractors",
    category: "Projects & Construction",
    slug: "contractor-demo",
    email: "owner@contractor-demo.example.com",
    badge: "Contractors ERP",
    desc: "Project BOQ tracking, retention money, sub-contractor measurement sheets & milestone billing.",
    icon: ShieldCheck,
    gradient: "from-violet-600/20 to-purple-600/10 border-violet-500/30 text-violet-400",
  },
  {
    title: "School & Educational Academy",
    category: "Education & Services",
    slug: "greenwood-demo",
    email: "owner@greenwood-demo.example.com",
    badge: "School ERP",
    desc: "Automated student term fee schedules, UPI links, guardian messaging & multi-branch finance.",
    icon: Sparkles,
    gradient: "from-emerald-600/20 to-teal-600/10 border-emerald-500/30 text-emerald-400",
  },
];

export function DesktopLaunchpadPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const lastTenantSlug = useAuthStore((s) => s.lastTenantSlug);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [serverLatency, setServerLatency] = useState<number | null>(null);
  const [autoConnecting, setAutoConnecting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tenantSlug: lastTenantSlug ?? "" },
  });

  const checkConnection = async () => {
    setServerStatus("checking");
    const start = performance.now();
    try {
      const res = await testServerConnection(getApiBase());
      const latency = Math.round(performance.now() - start);
      setServerLatency(latency);
      setServerStatus(res.ok ? "online" : "offline");
    } catch {
      setServerStatus("offline");
      setServerLatency(null);
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, []);

  async function executeLogin(slug: string, email: string, pass: string) {
    setServerError(null);
    try {
      const tokens = await apiFetch<{ access_token: string; refresh_token: string }>("/auth/login", {
        method: "POST",
        body: { tenant_slug: slug, email, password: pass },
        auth: false,
      });
      setSession({ tenantSlug: slug, accessToken: tokens.access_token, refreshToken: tokens.refresh_token });

      const me = await apiFetch<{ customer_id: string | null }>("/auth/me");
      if (me.customer_id) {
        setSession({ tenantSlug: slug, accessToken: "", refreshToken: "" });
        setServerError("Customer account detected. Please use the B2B portal login.");
        return;
      }

      navigate("/");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Failed to connect to workspace. Please check credentials.");
    }
  }

  async function onSubmit(values: FormValues) {
    await executeLogin(values.tenantSlug, values.email, values.password);
  }

  async function handleFastDemoLaunch(demo: typeof DEMO_WORKSPACES[0]) {
    setValue("tenantSlug", demo.slug);
    setValue("email", demo.email);
    setValue("password", "demo-password-123");
    setAutoConnecting(true);
    await executeLogin(demo.slug, demo.email, "demo-password-123");
    setAutoConnecting(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      {/* 1. Native Desktop Draggable Titlebar */}
      <header
        data-tauri-drag-region
        className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 bg-[#04070E] px-3.5 select-none z-50"
      >
        {/* Left: Brand & Native Version */}
        <div className="flex items-center gap-2.5 no-drag">
          <img src="/brand/symbol.svg" alt="MaterialOS" className="h-5 w-5" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-tight text-white">
              Material<span className="bg-gradient-to-r from-violet-400 to-sky-400 bg-clip-text text-transparent">OS</span> Workstation
            </span>
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
              Desktop v0.2.10
            </span>
          </div>
        </div>

        {/* Center: Cluster Status Beacon */}
        <div className="hidden sm:flex items-center gap-3 no-drag">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-mono">
            {serverStatus === "online" ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>Node Connected</span>
                {serverLatency && <span className="text-zinc-500">({serverLatency}ms)</span>}
              </span>
            ) : serverStatus === "checking" ? (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <RefreshCw className="h-3 w-3 animate-spin text-zinc-400" />
                <span>Checking cluster...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>Cluster Unreachable</span>
              </span>
            )}
            <span className="text-zinc-600">|</span>
            <Link
              to="/server-settings"
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <Server className="h-3 w-3 text-violet-400" />
              <span>{getApiBase().replace(/^https?:\/\//, "")}</span>
            </Link>
          </div>
        </div>

        {/* Right: Window Controls */}
        <div className="no-drag">
          <DesktopWindowControls />
        </div>
      </header>

      {/* 2. Hardware Peripherals Live Status Strip */}
      <div className="border-b border-white/5 bg-[#090D18]/90 px-4 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 text-[11px] font-mono">
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="font-semibold text-zinc-300 uppercase tracking-wider text-[10px]">
              Hardware Bridge:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-6 overflow-x-auto text-zinc-400">
            <div className="flex items-center gap-1.5 text-emerald-400" title="ESC/POS Thermal Receipt Printer Bridge">
              <Printer className="h-3.5 w-3.5" />
              <span>Thermal Printer: Ready</span>
            </div>

            <span className="text-zinc-700">•</span>

            <div className="flex items-center gap-1.5 text-sky-400" title="RS-232 / USB Weighing Scale COM Bridge">
              <Scale className="h-3.5 w-3.5" />
              <span>Scale: Auto-Detect</span>
            </div>

            <span className="text-zinc-700">•</span>

            <div className="flex items-center gap-1.5 text-violet-400" title="HID USB Barcode / 2D Scanner Wedge">
              <Barcode className="h-3.5 w-3.5" />
              <span>Scanner: HID Active</span>
            </div>

            <span className="text-zinc-700">•</span>

            <div className="flex items-center gap-1.5 text-amber-400" title="RJ11 24V Kick-pulse Cash Drawer">
              <Coins className="h-3.5 w-3.5" />
              <span>Cash Drawer: Ready</span>
            </div>

            <span className="text-zinc-700">•</span>

            <div className="flex items-center gap-1.5 text-teal-400" title="Local IndexedDB / SQLite Offline Queue">
              <Database className="h-3.5 w-3.5" />
              <span>Offline Cache: Synced</span>
            </div>
          </div>

          <div className="hidden lg:block text-zinc-500 text-[10px]">
            Station ID: WS-PRIMARY-01
          </div>
        </div>
      </div>

      {/* 3. Main Launchpad Workspace */}
      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
            {/* Left Column: 1-Click Fast Workspace Evaluation (Col span 7) */}
            <div className="space-y-6 lg:col-span-7">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  <span>Instant Workstation Sandbox</span>
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Connect to Your Enterprise Workspace
                </h1>
                <p className="mt-1.5 text-sm text-zinc-400">
                  Select a pre-configured industry profile for instantaneous 1-click evaluation, or connect to your organization's cloud or on-premises server.
                </p>
              </div>

              {/* 1-Click Demo Workspaces */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                  <span>Pre-Configured Enterprise Demo Stations</span>
                  <span className="font-mono text-zinc-500 text-[11px]">Pass: demo-password-123</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
                  {DEMO_WORKSPACES.map((demo) => {
                    const Icon = demo.icon;
                    return (
                      <div
                        key={demo.slug}
                        className="group relative rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-200 hover:border-violet-500/40 hover:bg-white/[0.04]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3.5">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br ${demo.gradient}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-white group-hover:text-violet-200 transition-colors">
                                  {demo.title}
                                </h3>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                                  {demo.badge}
                                </span>
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                                {demo.desc}
                              </p>
                              <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-zinc-500">
                                <span>Slug: <strong className="text-zinc-300 font-normal">{demo.slug}</strong></span>
                                <span>•</span>
                                <span>User: <strong className="text-zinc-300 font-normal">{demo.email}</strong></span>
                              </div>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            disabled={autoConnecting}
                            onClick={() => handleFastDemoLaunch(demo)}
                            className="shrink-0 h-9 rounded-lg bg-violet-600/30 hover:bg-violet-600 hover:text-white border border-violet-500/30 text-violet-200 text-xs font-semibold transition-all group-hover:border-violet-500/60"
                          >
                            <span>Launch Demo</span>
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Station Hotkeys Helper */}
              <div className="rounded-xl border border-white/5 bg-white/[0.015] p-3 text-xs text-zinc-400 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="font-medium text-zinc-300">Workstation Keyboard Accelerators:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-zinc-300">F2 POS Counter</span>
                  <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-zinc-300">Ctrl+K Search</span>
                  <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-zinc-300">Ctrl+J AI</span>
                  <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-zinc-300">F11 Fullscreen</span>
                </div>
              </div>
            </div>

            {/* Right Column: Custom Workspace Sign-in Form (Col span 5) */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-white/10 bg-[#0B0F19]/90 p-6 shadow-2xl backdrop-blur-xl md:p-8">
                <div className="mb-6 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                      Terminal Access
                    </span>
                    <Link
                      to="/server-settings"
                      className="text-[11px] text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <Server className="h-3 w-3 text-sky-400" />
                      <span>Node Config</span>
                    </Link>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    Sign In to Workstation
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Enter your organization's workspace credentials.
                  </p>
                </div>

                {serverError && (
                  <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                    {serverError}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-300">Workspace Domain / Slug</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                      <Input
                        {...register("tenantSlug")}
                        placeholder="e.g. sribalaji-demo or acme"
                        className="pl-9 bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-600 focus-visible:border-violet-500"
                      />
                    </div>
                    {errors.tenantSlug && (
                      <p className="text-xs text-rose-400">{errors.tenantSlug.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-300">Operator Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                      <Input
                        type="email"
                        {...register("email")}
                        placeholder="operator@company.com"
                        className="pl-9 bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-600 focus-visible:border-violet-500"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-rose-400">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-300">Password</Label>
                    <PasswordInput
                      {...register("password")}
                      placeholder="Enter workstation password"
                      className="bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-600 focus-visible:border-violet-500"
                    />
                    {errors.password && (
                      <p className="text-xs text-rose-400">{errors.password.message}</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSubmitting || autoConnecting}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-white shadow-lg shadow-violet-600/30 hover:from-violet-500 hover:to-indigo-500 transition-all hover:shadow-violet-600/50"
                    >
                      {isSubmitting || autoConnecting ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Authenticating Workstation...</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span>Sign In to Workstation</span>
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      )}
                    </Button>
                  </div>
                </form>

                {/* Additional Access Links */}
                <div className="mt-6 border-t border-white/10 pt-4 text-center">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <Link to="/server-settings" className="hover:text-white transition-colors">
                      On-Premises Server Setup
                    </Link>
                    <Link to="/portal/login" className="hover:text-white transition-colors">
                      Customer Portal
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 4. Desktop Bottom Diagnostic Bar */}
      <footer className="h-8 shrink-0 border-t border-white/10 bg-[#04070E] px-4 flex items-center justify-between text-[11px] font-mono text-zinc-500 select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>Tauri Native Runtime</span>
          </span>
          <span>•</span>
          <span>Architecture: x86_64 / arm64</span>
          <span>•</span>
          <span>Engine: WebKit / WebView2</span>
        </div>

        <div>
          MaterialOS Desktop Operating System &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
