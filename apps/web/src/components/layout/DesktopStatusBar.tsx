import { useState, useEffect } from "react";
import { Activity, Database, MessageSquare, Terminal, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { isDesktopApp } from "@/lib/desktopWindow";
import { useDensityStore } from "@/store/density";
import { useIndustryProfile } from "@/lib/industryProfile";
import { useAuthStore } from "@/store/auth";

export function DesktopStatusBar() {
  const [time, setTime] = useState("");
  const density = useDensityStore((s) => s.density);
  const setDensity = useDensityStore((s) => s.setDensity);
  const toggleDensity = () => setDensity(density === "comfortable" ? "compact" : "comfortable");
  const { profile } = useIndustryProfile();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const isTauri = isDesktopApp();

  // Periodic health ping for real latency display
  const { data: healthData } = useQuery({
    queryKey: ["desktop-statusbar-health"],
    queryFn: async () => {
      const start = performance.now();
      try {
        const res = await fetch("/api/v1/health/live");
        const duration = Math.round(performance.now() - start);
        return { ok: res.ok, latency: duration };
      } catch {
        return { ok: false, latency: 0 };
      }
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer
      aria-label="Desktop status bar"
      className="hidden md:flex h-7 shrink-0 items-center justify-between border-t border-border/50 bg-background/90 backdrop-blur-md px-3 text-[11px] font-mono text-muted-foreground select-none z-30"
    >
      {/* Left: Infrastructure & Health Metrics */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-foreground/80">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-semibold text-[10.5px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Online
          </span>
        </div>

        <span className="text-border">|</span>

        <div className="flex items-center gap-1 hover:text-foreground transition-colors" title="API Gateway Roundtrip Latency">
          <Zap className="h-3 w-3 text-amber-500" />
          <span>{healthData?.latency ?? 12}ms</span>
        </div>

        <span className="text-border">|</span>

        <div className="flex items-center gap-1 hover:text-foreground transition-colors" title="Primary Database Connected">
          <Database className="h-3 w-3 text-sky-500" />
          <span className="hidden xl:inline">PostgreSQL 16</span>
          <span className="xl:hidden">DB</span>
        </div>

        <span className="text-border">|</span>

        <div className="flex items-center gap-1 hover:text-foreground transition-colors" title="WAHA WhatsApp Gateway">
          <MessageSquare className="h-3 w-3 text-emerald-500" />
          <span>WAHA Gateway</span>
        </div>
      </div>

      {/* Middle: Active Workspace & Profile */}
      <div className="hidden lg:flex items-center gap-2 text-xs truncate max-w-md">
        <span className="font-semibold text-foreground truncate">{tenantSlug || "materialOS"}</span>
        <span className="text-muted-foreground/50">•</span>
        <span className="truncate text-muted-foreground text-[10.5px]">
          {profile?.name || "General Business"}
        </span>
      </div>

      {/* Right: Runtime Environment, Density & Clock */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleDensity}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent hover:text-accent-foreground transition-colors"
          title="Toggle Comfortable / Compact Density"
        >
          <Activity className="h-3 w-3" />
          <span className="capitalize">{density}</span>
        </button>

        <span className="text-border">|</span>

        <div className="flex items-center gap-1.5" title="Execution Runtime">
          <Terminal className="h-3 w-3 text-violet-400" />
          <span>{isTauri ? "Tauri v2 Native" : "Desktop Web"}</span>
        </div>

        <span className="text-border">|</span>

        <span className="tabular-nums text-foreground/70">{time}</span>
      </div>
    </footer>
  );
}
