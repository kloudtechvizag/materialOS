import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { UserCheck } from "lucide-react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const schema = z.object({
  tenantSlug: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

export function PortalLoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

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
      if (!me.customer_id) {
        clearSession();
        setServerError("This is a staff login. Use the main sign-in instead.");
        return;
      }

      setSession({
        tenantSlug: values.tenantSlug, accessToken: tokens.access_token, refreshToken: tokens.refresh_token,
        customerId: me.customer_id,
      });
      navigate("/portal");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not sign in. Try again.");
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <Card className="rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl text-white">
          <CardHeader className="space-y-3 pb-6">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-300">
                <UserCheck className="h-3.5 w-3.5 text-sky-400" />
                Customer Access Portal
              </span>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-white">Customer Portal Sign-In</CardTitle>
              <CardDescription className="text-zinc-400 mt-1">
                Enter the workspace, email, and password given to you by your supplier.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tenantSlug" className="text-xs font-medium text-zinc-300">Supplier Workspace Slug</Label>
                <Input
                  id="tenantSlug"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50"
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
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50"
                  placeholder="customer@company.com"
                  {...register("email")}
                />
                {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-zinc-300">Password</Label>
                <PasswordInput
                  id="password"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50"
                  {...register("password")}
                />
                {errors.password && <p className="text-xs text-rose-400">{errors.password.message}</p>}
              </div>

              {serverError && <p className="text-xs text-rose-400 font-medium">{serverError}</p>}

              <Button
                type="submit"
                size="lg"
                className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 font-semibold text-white hover:from-sky-500 hover:to-indigo-500 shadow-[0_0_25px_rgba(14,165,233,0.4)] transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign in to Customer Portal"}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-zinc-400">
              Staff member?{" "}
              <Link to="/login" className="font-semibold text-sky-400 underline-offset-4 hover:underline hover:text-sky-300">
                Go to staff sign-in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
