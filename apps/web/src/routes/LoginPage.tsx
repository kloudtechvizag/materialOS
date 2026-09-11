import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Badge } from "@/components/ui/badge";
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

/** Real reachability against this device's configured server, not a
 * decorative dot -- reuses the same /health/live check Server Settings
 * uses. Re-checks on the browser's online/offline events so a user who
 * plugs their network back in sees it update without reloading. */
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

function ConnectionBadge({ state }: { state: ConnectionState }) {
  if (state === "checking") return <Badge variant="secondary">Checking connection...</Badge>;
  if (state === "online") return <Badge variant="success">Online</Badge>;
  return <Badge variant="destructive">Can't reach server</Badge>;
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
    <AuthLayout>
      <div className="w-full max-w-md">
        <Card className="rounded-xl border-[#E2E8F0] shadow-sm">
          <CardHeader>
            <div className="mb-1 flex items-center">
              <img src="/brand/symbol.svg" alt="" className="h-8 w-8 md:hidden" />
              <div className="ml-auto">
                <ConnectionBadge state={connection} />
              </div>
            </div>
            <CardTitle>{lastTenantSlug ? `Welcome back to ${lastTenantSlug}` : "Sign in to MaterialOS"}</CardTitle>
            <CardDescription>
              {lastTenantSlug ? "Sign in to continue to your workspace." : "Enter your workspace, email, and password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tenantSlug">Workspace</Label>
                <Input id="tenantSlug" className="h-11" placeholder="sribalaji" {...register("tenantSlug")} />
                {errors.tenantSlug && <p className="text-sm text-destructive">{errors.tenantSlug.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" className="h-11" placeholder="owner@yourcompany.com" {...register("email")} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <PasswordInput id="password" className="h-11" {...register("password")} />
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>
              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
              <Button type="submit" size="lg" className="w-full bg-[#7C3AED] text-white hover:bg-[#6D28D9]" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <div className="my-5 h-px bg-[#E2E8F0]" />

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <Link to="/signup" className="font-medium text-[#7C3AED] underline-offset-4 hover:underline">
                Create a workspace
              </Link>
              <span className="text-[#E2E8F0]">|</span>
              <Link to="/portal/login" className="font-medium text-[#7C3AED] underline-offset-4 hover:underline">
                Customer portal
              </Link>
              <span className="text-[#E2E8F0]">|</span>
              <Link to="/server-settings" className="text-muted-foreground/70 underline-offset-4 hover:underline">
                Server settings
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
