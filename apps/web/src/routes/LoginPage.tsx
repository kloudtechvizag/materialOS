import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

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
  tenantSlug: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

type ConnectionState = "checking" | "online" | "offline";

/** Real reachability against this device's configured server with live pulsing beacon. */
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
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-400">
        <span className="h-2 w-2 rounded-full bg-zinc-400 animate-pulse" />
        Checking node...
      </span>
    );
  }
  if (state === "online") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        Backend Operational
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400">
      <span className="h-2 w-2 rounded-full bg-rose-500" />
      Server Unreachable
    </span>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const lastTenantSlug = useAuthStore((s) => s.lastTenantSlug);
  const [serverError, setServerError] = useState<string | null>(null);
  const connection = useConnectionStatus();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tenantSlug: lastTenantSlug ?? "" },
  });

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
        setServerError("This is a customer login. Use the customer portal sign-in instead.");
        return;
      }

      navigate("/");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not sign in. Try again.");
    }
  }

  return (
    <AuthLayout active="login">
      <div className="w-full max-w-md">
        <Card className="rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl text-white">
          <CardHeader className="space-y-3 pb-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">Staff Access</span>
              <ConnectionBeacon state={connection} />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-white">
                {lastTenantSlug ? `Welcome back to ${lastTenantSlug}` : "Sign in to MaterialOS"}
              </CardTitle>
              <CardDescription className="text-zinc-400 mt-1">
                {lastTenantSlug ? "Sign in to continue to your workspace." : "Enter your workspace, email, and password."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tenantSlug" className="text-xs font-medium text-zinc-300">Workspace Slug</Label>
                <Input
                  id="tenantSlug"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                  placeholder="sribalaji"
                  {...register("tenantSlug")}
                />
                {errors.tenantSlug && <p className="text-xs text-rose-400">{errors.tenantSlug.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-zinc-300">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                  placeholder="owner@yourcompany.com"
                  {...register("email")}
                />
                {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-zinc-300">Password</Label>
                <PasswordInput
                  id="password"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                  {...register("password")}
                />
                {errors.password && <p className="text-xs text-rose-400">{errors.password.message}</p>}
              </div>

              {serverError && <p className="text-xs text-rose-400 font-medium">{serverError}</p>}

              <Button
                type="submit"
                size="lg"
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-white hover:from-violet-500 hover:to-indigo-500 shadow-[0_0_25px_rgba(124,58,237,0.4)] transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign in to Workspace"}
              </Button>
            </form>

            <div className="my-6 h-px bg-white/10" />

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-zinc-400">
              <Link to="/signup" className="font-medium text-violet-400 underline-offset-4 hover:underline hover:text-violet-300">
                Create a workspace
              </Link>
              <span className="text-white/20">|</span>
              <Link to="/portal/login" className="font-medium text-violet-400 underline-offset-4 hover:underline hover:text-violet-300">
                Customer portal
              </Link>
              <span className="text-white/20">|</span>
              <Link to="/server-settings" className="text-zinc-400 underline-offset-4 hover:underline hover:text-zinc-200">
                Server settings
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
