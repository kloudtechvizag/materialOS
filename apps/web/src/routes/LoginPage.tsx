import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Building2, Mail, Lock, Sparkles, ArrowRight, ShieldAlert } from "lucide-react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { apiFetch, ApiError } from "@/lib/api";
import { getApiBase, testServerConnection } from "@/lib/serverConfig";
import { useAuthStore } from "@/store/auth";

const schema = z.object({
  tenantSlug: z.string().min(1, "Workspace slug is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

type ConnectionState = "checking" | "online" | "offline";

function useConnectionStatus(): ConnectionState {
  const [state, setState] = useState<ConnectionState>("checking");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      setState("checking");
      const result = await testServerConnection(getApiBase());
      if (!cancelled) setState(result.ok ? "online" : "offline");
    }
    check();
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    return () => {
      cancelled = true;
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
    };
  }, []);

  return state;
}

function ConnectionBeacon({ state }: { state: ConnectionState }) {
  if (state === "checking") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse" />
        Checking cluster...
      </span>
    );
  }
  if (state === "online") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Cluster Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-400">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      Cluster Unreachable
    </span>
  );
}

const DEMO_ACCOUNTS = [
  { label: "Sri Balaji Materials", slug: "sribalaji-demo", email: "owner@sribalaji-demo.example.com", badge: "Enterprise" },
  { label: "Fashion Hub Retail", slug: "fashionhub-demo", email: "owner@fashionhub-demo.example.com", badge: "POS" },
  { label: "ABC Medicals", slug: "abcmedicals-demo", email: "owner@abcmedicals-demo.example.com", badge: "FEFO" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const lastTenantSlug = useAuthStore((s) => s.lastTenantSlug);
  const [serverError, setServerError] = useState<string | null>(null);
  const connection = useConnectionStatus();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tenantSlug: lastTenantSlug ?? "" },
  });

  const tenantSlugValue = watch("tenantSlug");

  function loadDemo(account: typeof DEMO_ACCOUNTS[0]) {
    setValue("tenantSlug", account.slug, { shouldValidate: true });
    setValue("email", account.email, { shouldValidate: true });
    setValue("password", "demo-password-123", { shouldValidate: true });
    setServerError(null);
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const tokens = await apiFetch<{ access_token: string; refresh_token: string }>("/auth/login", {
        method: "POST",
        body: { tenant_slug: values.tenantSlug, email: values.email, password: values.password },
        auth: false,
      });
      setSession({ tenantSlug: values.tenantSlug, accessToken: tokens.access_token, refreshToken: tokens.refresh_token });

      const me = await apiFetch<{ customer_id: string | null }>("/auth/me");
      if (me.customer_id) {
        setSession({ tenantSlug: values.tenantSlug, accessToken: "", refreshToken: "" });
        setServerError("This is a customer login. Please use the customer portal sign-in.");
        return;
      }

      navigate("/");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not sign in. Please verify your credentials.");
    }
  }

  return (
    <AuthLayout active="login">
      <div className="w-full max-w-md">
        {/* Quick Demo Credentials Bar */}
        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-violet-400" />
              1-Click Demo Evaluation
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Password: demo-password-123</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.slug}
                type="button"
                onClick={() => loadDemo(acc)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  tenantSlugValue === acc.slug
                    ? "border border-violet-500/50 bg-violet-500/20 text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]"
                    : "border border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:text-white"
                }`}
              >
                <span>{acc.label}</span>
                <span className="rounded bg-black/40 px-1 py-0.2 text-[9px] font-mono text-violet-300">{acc.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Auth Glass Card */}
        <Card className="rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl text-white">
          <CardHeader className="space-y-3 pb-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-violet-300">
                Staff Authentication
              </span>
              <ConnectionBeacon state={connection} />
            </div>
            <div>
              <CardTitle className="text-2xl font-extrabold tracking-tight text-white">
                {lastTenantSlug ? `Sign in to ${lastTenantSlug}` : "Sign in to Workspace"}
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                Enter your workspace slug, verified email address, and credentials.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Workspace Slug */}
              <div className="space-y-1.5">
                <Label htmlFor="tenantSlug" className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-violet-400" />
                    Workspace Slug
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {tenantSlugValue ? `${tenantSlugValue}.materialos.com` : "yourcompany"}
                  </span>
                </Label>
                <div className="relative">
                  <Input
                    id="tenantSlug"
                    className="h-11 rounded-xl border-white/10 bg-white/5 pl-3.5 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                    placeholder="e.g. sribalaji-demo"
                    {...register("tenantSlug")}
                  />
                </div>
                {errors.tenantSlug && <p className="text-[11px] text-rose-400 font-medium">{errors.tenantSlug.message}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-violet-400" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  className="h-11 rounded-xl border-white/10 bg-white/5 pl-3.5 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                  placeholder="owner@yourcompany.com"
                  {...register("email")}
                />
                {errors.email && <p className="text-[11px] text-rose-400 font-medium">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-violet-400" />
                  Password
                </Label>
                <PasswordInput
                  id="password"
                  className="h-11 rounded-xl border-white/10 bg-white/5 pl-3.5 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                  {...register("password")}
                />
                {errors.password && <p className="text-[11px] text-rose-400 font-medium">{errors.password.message}</p>}
              </div>

              {serverError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 font-semibold text-white shadow-[0_0_25px_rgba(124,58,237,0.35)] transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-[0_0_35px_rgba(124,58,237,0.5)]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    Authenticating Node...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    Sign In to Console <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="my-5 h-px bg-white/10" />

            {/* Sub-links */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-zinc-400">
              <Link to="/signup" className="font-medium text-violet-400 hover:text-violet-300 transition-colors">
                Create new workspace
              </Link>
              <span className="text-white/20">•</span>
              <Link to="/portal/login" className="font-medium text-violet-400 hover:text-violet-300 transition-colors">
                Customer portal
              </Link>
              <span className="text-white/20">•</span>
              <Link to="/server-settings" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                Server cluster
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
