import { useState } from "react";
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
import { useAuthStore } from "@/store/auth";

const schema = z.object({
  tenantSlug: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

/** Mirrors PortalLoginPage.tsx (customer portal, ADR-009) exactly,
 * checking guardian_id instead of customer_id. */
export function GuardianPortalLoginPage() {
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

      const me = await apiFetch<{ guardian_id: string | null }>("/auth/me");
      if (!me.guardian_id) {
        clearSession();
        setServerError("This is not a guardian portal login. Use the main sign-in instead.");
        return;
      }

      setSession({
        tenantSlug: values.tenantSlug, accessToken: tokens.access_token, refreshToken: tokens.refresh_token,
        guardianId: me.guardian_id,
      });
      navigate("/guardian-portal");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not sign in. Try again.");
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <Card className="rounded-xl border-[#E2E8F0] shadow-sm">
          <CardHeader>
            <CardTitle>Parent portal sign-in</CardTitle>
            <CardDescription>Enter the school workspace, email, and password given to you by the school.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tenantSlug">School workspace</Label>
                <Input id="tenantSlug" className="h-11" placeholder="sunrise-public-school" {...register("tenantSlug")} />
                {errors.tenantSlug && <p className="text-sm text-destructive">{errors.tenantSlug.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" className="h-11" {...register("email")} />
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
            <p className="mt-5 text-center text-sm text-muted-foreground">
              School staff member?{" "}
              <Link to="/login" className="font-medium text-[#7C3AED] underline-offset-4 hover:underline">
                Go to staff sign-in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
