import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Seo } from "@/components/marketing/Seo";
import { Breadcrumbs, breadcrumbJsonLd } from "@/components/marketing/Breadcrumbs";
import { ALL_INDUSTRIES } from "@/marketing/content/industries";
import { apiFetch, ApiError } from "@/lib/api";

const BREADCRUMB_ITEMS = [{ label: "Home", href: "/" }, { label: "Book a demo" }];

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  industry_slug: string;
  message: string;
}

/** The only page with real client-side interactivity + a network call
 * -- deliberately plain useState + apiFetch rather than react-query, so
 * every other marketing page (including this one during the build-time
 * prerender pass) stays free of any data-fetching/hydration concerns.
 * Posts to the genuinely unauthenticated POST /public/demo-requests
 * (apps/api/app/api/v1/public.py). */
export function BookDemoPage() {
  const [params] = useSearchParams();
  const [form, setForm] = useState<FormState>({
    full_name: "", email: "", phone: "", company_name: "",
    industry_slug: params.get("industry") ?? "", message: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      await apiFetch("/public/demo-requests", {
        method: "POST",
        auth: false,
        body: {
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || undefined,
          company_name: form.company_name,
          industry_slug: form.industry_slug || undefined,
          message: form.message || undefined,
          source_page: window.location.pathname,
        },
      });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <Seo
        title="Book a Demo -- See MaterialOS Configured for Your Industry"
        description="Book a demo of MaterialOS and see it configured for your specific industry -- building materials, retail, pharmacy, and more."
        path="/book-demo"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/book-demo")}
      />
      <Breadcrumbs items={BREADCRUMB_ITEMS} />
      <h1 className="mt-4 text-3xl font-semibold">Book a demo</h1>
      <p className="mt-2 text-muted-foreground">Tell us about your business and we'll walk you through MaterialOS configured for it.</p>

      {status === "success" ? (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-[#10B981]" />
          <p className="mt-3 font-medium">Thanks -- we've got your request.</p>
          <p className="mt-1 text-sm text-muted-foreground">Someone from MaterialOS will reach out shortly.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_name">Company name</Label>
            <Input id="company_name" required value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="industry_slug">Industry (optional)</Label>
            <select
              id="industry_slug"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.industry_slug}
              onChange={(e) => setForm((f) => ({ ...f, industry_slug: e.target.value }))}
            >
              <option value="">Select an industry</option>
              {ALL_INDUSTRIES.map((industry) => (
                <option key={industry.slug} value={industry.slug}>{industry.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">What are you looking to solve? (optional)</Label>
            <textarea
              id="message"
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
          </div>

          {status === "error" && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full bg-[#7C3AED] text-white hover:bg-[#6D28D9]" disabled={status === "submitting"}>
            {status === "submitting" ? "Submitting..." : "Book a demo"}
          </Button>
        </form>
      )}
    </div>
  );
}
