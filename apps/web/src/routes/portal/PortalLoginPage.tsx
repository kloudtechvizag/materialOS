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
      <Card className="w-full max-w-sm rounded-2xl shadow-xl">
        <CardHeader>
          <img src="/brand/symbol.svg" alt="" className="mb-2 h-8 w-8 lg:hidden" />
          <CardTitle>Customer portal sign-in</CardTitle>
          <CardDescription>Enter the workspace, email, and password given to you by your supplier.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tenantSlug">Workspace</Label>
              <Input id="tenantSlug" placeholder="sribalaji" {...register("tenantSlug")} />
              {errors.tenantSlug && <p className="text-sm text-destructive">{errors.tenantSlug.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Staff member?{" "}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Go to staff sign-in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
