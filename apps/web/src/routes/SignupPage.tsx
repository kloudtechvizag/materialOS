import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api";
import { INDIAN_STATES } from "@/lib/indianStates";
import { useAuthStore } from "@/store/auth";

interface IndustryProfileOption {
  slug: string;
  name: string;
}

const schema = z.object({
  companyName: z.string().min(1, "Required"),
  companyState: z.string().min(1, "Required -- this decides CGST+SGST vs IGST on every invoice"),
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
    <AuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader>
          <img src="/brand/symbol.png" alt="" className="mb-2 h-8 w-8 lg:hidden" />
          <CardTitle>Create your MaterialOS workspace</CardTitle>
          <CardDescription>Takes about a minute. You can import your Tally data right after.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company name</Label>
              <Input id="companyName" placeholder="Your company name" {...register("companyName")} />
              {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="companyState">Business state</Label>
              <select
                id="companyState"
                defaultValue=""
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register("companyState")}
              >
                <option value="" disabled>Select state</option>
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              {errors.companyState && <p className="text-sm text-destructive">{errors.companyState.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="companyCity">City / Town</Label>
              <Input id="companyCity" placeholder="Vijayawada" {...register("companyCity")} />
              {errors.companyCity && <p className="text-sm text-destructive">{errors.companyCity.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="industrySlug">Industry</Label>
              <select
                id="industrySlug"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register("industrySlug")}
              >
                {(industries ?? [{ slug: "building_materials", name: "Building Materials" }]).map((i) => (
                  <option key={i.slug} value={i.slug}>{i.name}</option>
                ))}
              </select>
              {errors.industrySlug && <p className="text-sm text-destructive">{errors.industrySlug.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tenantSlug">Workspace URL name</Label>
              <Input id="tenantSlug" placeholder="sribalaji" {...register("tenantSlug")} />
              {errors.tenantSlug && <p className="text-sm text-destructive">{errors.tenantSlug.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownerFullName">Your name</Label>
              <Input id="ownerFullName" {...register("ownerFullName")} />
              {errors.ownerFullName && <p className="text-sm text-destructive">{errors.ownerFullName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownerEmail">Your email</Label>
              <Input id="ownerEmail" type="email" {...register("ownerEmail")} />
              {errors.ownerEmail && <p className="text-sm text-destructive">{errors.ownerEmail.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownerPassword">Password</Label>
              <Input id="ownerPassword" type="password" {...register("ownerPassword")} />
              {errors.ownerPassword && <p className="text-sm text-destructive">{errors.ownerPassword.message}</p>}
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating workspace..." : "Create workspace"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have a workspace?{" "}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            <Link to="/server-settings" className="underline-offset-4 hover:underline">Server settings</Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
