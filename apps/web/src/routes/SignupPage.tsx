import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Sparkles, Building2, User, Layers, CheckCircle2, ArrowRight } from "lucide-react";

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
  companyName: z.string().min(1, "Company name is required"),
  companyState: z.string().min(1, "State is required (determines GST logic)"),
  companyCity: z.string().min(1, "City / Town is required"),
  industrySlug: z.string().min(1, "Industry profile is required"),
  tenantSlug: z
    .string()
    .min(3, "At least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  ownerFullName: z.string().min(1, "Your name is required"),
  ownerEmail: z.string().email("Enter a valid work email"),
  ownerPassword: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialIndustry = searchParams.get("industry") ?? "building_materials";

  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: industries } = useQuery({
    queryKey: ["industry-profiles"],
    queryFn: () => apiFetch<IndustryProfileOption[]>("/industry-profiles", { auth: false }),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { industrySlug: initialIndustry },
  });

  const tenantSlug = watch("tenantSlug") ?? "";
  const password = watch("ownerPassword") ?? "";

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "Empty", color: "bg-zinc-700" };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score: 25, label: "Weak", color: "bg-rose-500" };
    if (score === 2) return { score: 50, label: "Fair", color: "bg-amber-500" };
    if (score === 3) return { score: 75, label: "Good", color: "bg-sky-400" };
    return { score: 100, label: "Strong", color: "bg-emerald-400" };
  }, [password]);

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
      setServerError(err instanceof ApiError ? err.message : "Could not initialize workspace. Please try again.");
    }
  }

  return (
    <AuthLayout active="signup">
      <div className="w-full max-w-lg my-6">
        <Card className="rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl text-white">
          <CardHeader className="space-y-2 pb-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
                <Sparkles className="h-3 w-3 text-violet-400" />
                14-Day Full-Access Enterprise Trial
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Zero Card Required</span>
            </div>
            <div>
              <CardTitle className="text-2xl font-extrabold tracking-tight text-white">
                Deploy your MaterialOS workspace
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                Automated database-isolated instance configured with your industry profile in under 60 seconds.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Company & Industry Section */}
              <div className="space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-violet-400" />
                  Organization & Industry Vertical
                </span>

                <div className="space-y-1.5">
                  <Label htmlFor="companyName" className="text-xs font-medium text-zinc-300">
                    Company Registered Name
                  </Label>
                  <Input
                    id="companyName"
                    placeholder="e.g. Acme Building Materials Pvt Ltd"
                    className="h-10 rounded-xl border-white/10 bg-white/5 pl-3 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                    {...register("companyName")}
                  />
                  {errors.companyName && <p className="text-[11px] text-rose-400 font-medium">{errors.companyName.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="companyState" className="text-xs font-medium text-zinc-300">
                      Business State (GST)
                    </Label>
                    <select
                      id="companyState"
                      defaultValue=""
                      className="flex h-10 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-xs text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                      {...register("companyState")}
                    >
                      <option value="" disabled className="bg-[#0B0F19] text-zinc-500">Select State</option>
                      {INDIAN_STATES.map((state) => (
                        <option key={state} value={state} className="bg-[#0B0F19] text-white">{state}</option>
                      ))}
                    </select>
                    {errors.companyState && <p className="text-[11px] text-rose-400 font-medium">{errors.companyState.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="companyCity" className="text-xs font-medium text-zinc-300">
                      City / Hub
                    </Label>
                    <Input
                      id="companyCity"
                      placeholder="e.g. Visakhapatnam"
                      className="h-10 rounded-xl border-white/10 bg-white/5 pl-3 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                      {...register("companyCity")}
                    />
                    {errors.companyCity && <p className="text-[11px] text-rose-400 font-medium">{errors.companyCity.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="industrySlug" className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-violet-400" />
                      Industry Operating Engine
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">Pre-wires rules</span>
                  </Label>
                  <select
                    id="industrySlug"
                    className="flex h-10 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-xs text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                    {...register("industrySlug")}
                  >
                    {(industries ?? [{ slug: "building_materials", name: "Building Materials & Steel" }]).map((i) => (
                      <option key={i.slug} value={i.slug} className="bg-[#0B0F19] text-white">
                        {i.name}
                      </option>
                    ))}
                  </select>
                  {errors.industrySlug && <p className="text-[11px] text-rose-400 font-medium">{errors.industrySlug.message}</p>}
                </div>

                {/* Subdomain URL */}
                <div className="space-y-1.5">
                  <Label htmlFor="tenantSlug" className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                    <span>Dedicated Cluster Subdomain</span>
                    {tenantSlug && (
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Available
                      </span>
                    )}
                  </Label>
                  <div className="flex rounded-xl border border-white/10 bg-white/5 overflow-hidden focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/50">
                    <span className="flex items-center px-3 text-[11px] font-mono text-zinc-400 bg-white/5 border-r border-white/10 shrink-0">
                      https://
                    </span>
                    <Input
                      id="tenantSlug"
                      placeholder="mycompany"
                      className="h-10 border-0 bg-transparent text-xs text-white placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono"
                      {...register("tenantSlug")}
                    />
                    <span className="flex items-center px-3 text-[11px] font-mono text-zinc-400 bg-white/5 border-l border-white/10 shrink-0">
                      .materialos.com
                    </span>
                  </div>
                  {errors.tenantSlug && <p className="text-[11px] text-rose-400 font-medium">{errors.tenantSlug.message}</p>}
                </div>
              </div>

              {/* Owner Account Section */}
              <div className="space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-violet-400" />
                  Primary Administrator Credentials
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ownerFullName" className="text-xs font-medium text-zinc-300">
                      Full Name
                    </Label>
                    <Input
                      id="ownerFullName"
                      placeholder="e.g. Ramesh Kumar"
                      className="h-10 rounded-xl border-white/10 bg-white/5 pl-3 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                      {...register("ownerFullName")}
                    />
                    {errors.ownerFullName && <p className="text-[11px] text-rose-400 font-medium">{errors.ownerFullName.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ownerEmail" className="text-xs font-medium text-zinc-300">
                      Work Email
                    </Label>
                    <Input
                      id="ownerEmail"
                      type="email"
                      placeholder="owner@company.com"
                      className="h-10 rounded-xl border-white/10 bg-white/5 pl-3 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                      {...register("ownerEmail")}
                    />
                    {errors.ownerEmail && <p className="text-[11px] text-rose-400 font-medium">{errors.ownerEmail.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ownerPassword" className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                    <span>Account Master Password</span>
                    {password && (
                      <span className="text-[10px] font-mono text-zinc-400">
                        Strength: <strong className="text-white">{passwordStrength.label}</strong>
                      </span>
                    )}
                  </Label>
                  <PasswordInput
                    id="ownerPassword"
                    placeholder="Minimum 8 characters"
                    className="h-10 rounded-xl border-white/10 bg-white/5 pl-3 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                    {...register("ownerPassword")}
                  />
                  {/* Password Strength Meter */}
                  {password && (
                    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                        style={{ width: `${passwordStrength.score}%` }}
                      />
                    </div>
                  )}
                  {errors.ownerPassword && <p className="text-[11px] text-rose-400 font-medium">{errors.ownerPassword.message}</p>}
                </div>
              </div>

              {serverError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300">
                  {serverError}
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
                    Provisioning Instance...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    Launch MaterialOS Workspace <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-zinc-400">
              Already have an active workspace?{" "}
              <Link to="/login" className="font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                Sign in to your cluster
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-zinc-500">
          <Link to="/server-settings" className="hover:text-zinc-300 transition-colors">
            Self-Hosted Server & Database Settings
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
