import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Sparkles } from "lucide-react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { apiFetch, ApiError } from "@/lib/api";
import { INDIAN_STATES } from "@/lib/indianStates";
import { useAuthStore } from "@/store/auth";

interface IndustryProfileOption {
  slug: string;
  name: string;
}

const schema = z.object({
  companyName: z.string().min(1, "Required"),
  companyState: z.string().min(1, "Required -- decides GST tax computation"),
  companyCity: z.string().min(1, "Required"),
  industrySlug: z.string().min(1, "Required"),
  tenantSlug: z
    .string()
    .min(3, "At least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  ownerFullName: z.string().min(1, "Required"),
  ownerEmail: z.string().email("Enter a valid email"),
  ownerPassword: z.string().min(8, "At least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export function SignupPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: industries } = useQuery({
    queryKey: ["industry-profiles"],
    queryFn: () => apiFetch<IndustryProfileOption[]>("/industry-profiles", { auth: false }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { industrySlug: "building_materials" } });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await apiFetch("/tenants/signup", {
        method: "POST",
        auth: false,
        body: {
          tenant_name: values.companyName,
          tenant_slug: values.tenantSlug,
          company_name: values.companyName,
          company_legal_name: values.companyName,
          company_state: values.companyState,
          company_city: values.companyCity,
          industry_slug: values.industrySlug,
          owner_full_name: values.ownerFullName,
          owner_email: values.ownerEmail,
          owner_password: values.ownerPassword,
        },
      });

      const tokens = await apiFetch<{ access_token: string; refresh_token: string }>("/auth/login", {
        method: "POST",
        auth: false,
        body: { tenant_slug: values.tenantSlug, email: values.ownerEmail, password: values.ownerPassword },
      });
      setSession({ tenantSlug: values.tenantSlug, accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      navigate("/imports");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not create your workspace. Try again.");
    }
  }

  return (
    <AuthLayout active="signup">
      <div className="w-full max-w-md my-6">
        <Card className="rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl text-white">
          <CardHeader className="space-y-3 pb-6">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
                <Sparkles className="h-3 w-3 text-violet-400" />
                Instant Setup • 14-Day Full Access Trial
              </span>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-white">
                Create your MaterialOS workspace
              </CardTitle>
              <CardDescription className="text-zinc-400 mt-1">
                Takes about a minute. You can import your Tally / ERP data right after.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName" className="text-xs font-medium text-zinc-300">Company Name</Label>
                <Input
                  id="companyName"
                  placeholder="Your Company Pvt Ltd"
                  className="h-10 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                  {...register("companyName")}
                />
                {errors.companyName && <p className="text-xs text-rose-400">{errors.companyName.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="companyState" className="text-xs font-medium text-zinc-300">Business State (GST)</Label>
                  <select
                    id="companyState"
                    defaultValue=""
                    className="flex h-10 w-full rounded-md border border-white/10 bg-[#0D121F] px-3 text-xs text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                    {...register("companyState")}
                  >
                    <option value="" disabled className="bg-[#0D121F] text-zinc-400">Select State</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state} className="bg-[#0D121F] text-white">{state}</option>
                    ))}
                  </select>
                  {errors.companyState && <p className="text-xs text-rose-400">{errors.companyState.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="companyCity" className="text-xs font-medium text-zinc-300">City / Town</Label>
                  <Input
                    id="companyCity"
                    placeholder="Vijayawada"
                    className="h-10 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                    {...register("companyCity")}
                  />
                  {errors.companyCity && <p className="text-xs text-rose-400">{errors.companyCity.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="industrySlug" className="text-xs font-medium text-zinc-300">Industry Profile</Label>
                <select
                  id="industrySlug"
                  className="flex h-10 w-full rounded-md border border-white/10 bg-[#0D121F] px-3 text-xs text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                  {...register("industrySlug")}
                >
                  {(industries ?? [{ slug: "building_materials", name: "Building Materials & Steel" }]).map((i) => (
                    <option key={i.slug} value={i.slug} className="bg-[#0D121F] text-white">{i.name}</option>
                  ))}
                </select>
                {errors.industrySlug && <p className="text-xs text-rose-400">{errors.industrySlug.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenantSlug" className="text-xs font-medium text-zinc-300">Workspace Subdomain URL</Label>
                <div className="flex rounded-md border border-white/10 bg-white/5 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/50">
                  <span className="flex items-center px-3 text-xs font-mono text-zinc-400 bg-white/5 border-r border-white/10 rounded-l-md shrink-0">
                    app.materialos.com/
                  </span>
                  <Input
                    id="tenantSlug"
                    placeholder="sribalaji"
                    className="h-10 border-0 bg-transparent text-white placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                    {...register("tenantSlug")}
                  />
                </div>
                {errors.tenantSlug && <p className="text-xs text-rose-400">{errors.tenantSlug.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ownerFullName" className="text-xs font-medium text-zinc-300">Your Full Name</Label>
                  <Input
                    id="ownerFullName"
                    placeholder="Srikanth Rao"
                    className="h-10 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-violet-500"
                    {...register("ownerFullName")}
                  />
                  {errors.ownerFullName && <p className="text-xs text-rose-400">{errors.ownerFullName.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ownerEmail" className="text-xs font-medium text-zinc-300">Work Email</Label>
                  <Input
                    id="ownerEmail"
                    type="email"
                    placeholder="owner@company.com"
                    className="h-10 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-violet-500"
                    {...register("ownerEmail")}
                  />
                  {errors.ownerEmail && <p className="text-xs text-rose-400">{errors.ownerEmail.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerPassword" className="text-xs font-medium text-zinc-300">Password</Label>
                <PasswordInput
                  id="ownerPassword"
                  className="h-10 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-violet-500"
                  {...register("ownerPassword")}
                />
                {errors.ownerPassword && <p className="text-xs text-rose-400">{errors.ownerPassword.message}</p>}
              </div>

              {serverError && <p className="text-xs text-rose-400 font-medium">{serverError}</p>}

              <Button
                type="submit"
                size="lg"
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-white hover:from-violet-500 hover:to-indigo-500 shadow-[0_0_25px_rgba(124,58,237,0.4)] transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating workspace..." : "Launch MaterialOS Workspace"}
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-zinc-400">
              Already registered?{" "}
              <Link to="/login" className="font-semibold text-violet-400 underline-offset-4 hover:underline hover:text-violet-300">
                Sign in to your workspace
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-zinc-500">
          <Link to="/server-settings" className="underline-offset-4 hover:underline hover:text-zinc-300">
            Self-Hosted Server Settings
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
