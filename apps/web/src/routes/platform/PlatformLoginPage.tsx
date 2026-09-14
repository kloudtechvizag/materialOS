import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError } from "@/lib/api";
import { platformFetch } from "@/lib/platformApi";
import { usePlatformAuthStore } from "@/store/platformAuth";

/** Deliberately plain and unbranded next to the tenant-facing login --
 * this is MaterialOS-the-company's own back door, not a customer-facing
 * screen, so it doesn't share MarketingHeader or AuthLayout's hero. */
export function PlatformLoginPage() {
  const navigate = useNavigate();
  const setToken = usePlatformAuthStore((s) => s.setToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { access_token } = await platformFetch<{ access_token: string }>("/platform/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setToken(access_token);
      navigate("/platform/tenants");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1220] p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>MaterialOS Platform</CardTitle>
          <CardDescription>Internal operator console -- not a tenant login.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
