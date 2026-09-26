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
    <div className="relative min-h-screen overflow-hidden bg-[#070B14] text-white selection:bg-violet-500/30 selection:text-violet-200">
      <Seo
        title="Book a Demo -- See MaterialOS Configured for Your Industry"
        description="Book a demo of MaterialOS and see it configured for your specific industry -- building materials, retail, pharmacy, and more."
        path="/book-demo"
        jsonLd={breadcrumbJsonLd(BREADCRUMB_ITEMS, "/book-demo")}
      />

      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[550px] w-[900px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.25)_0%,rgba(59,130,246,0.12)_45%,transparent_75%)] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-8">
        <Breadcrumbs items={BREADCRUMB_ITEMS} />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start">
          {/* Left Column: Context & Proof */}
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1 text-xs font-semibold text-violet-300">
              <span>Tailored Walkthrough • Senior Architect Led</span>
            </div>

            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-white sm:text-5xl sm:leading-[1.15]">
              Experience MaterialOS{" "}
              <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
                in Real-Time.
              </span>
            </h1>

            <p className="mt-4 text-base leading-relaxed text-zinc-300">
              Tell us about your operations and a Solutions Engineer will prepare a live sandbox pre-seeded with your industry's exact ledger rules, barcode formats, and compliance workflows.
            </p>

            <div className="mt-8 space-y-4">
              {[
                { title: "Pre-Configured Industry Sandbox", desc: "No generic slide decks. We show real transactions and print templates." },
                { title: "Legacy Migration Assessment", desc: "Understand automated import options for Tally, Busy, or spreadsheets." },
                { title: "Custom Architecture Q&A", desc: "Discuss multi-branch latency, offline resilience, and hardware connectivity." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-md">
                  <p className="font-semibold text-white text-sm">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Dark Glass Booking Form */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              {status === "success" ? (
                <div className="flex flex-col items-center rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-white">Demonstration Request Confirmed</h3>
                  <p className="mt-2 text-sm text-zinc-300 max-w-xs leading-relaxed">
                    Our solutions engineering lead will review your industry parameters and reach out within 4 business hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="full_name" className="text-xs font-medium text-zinc-300">Full Name</Label>
                      <Input
                        id="full_name"
                        required
                        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                        placeholder="John Doe"
                        value={form.full_name}
                        onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-medium text-zinc-300">Work Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                        placeholder="john@company.com"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs font-medium text-zinc-300">Phone (optional)</Label>
                      <Input
                        id="phone"
                        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                        placeholder="+91 98765 43210"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="company_name" className="text-xs font-medium text-zinc-300">Company Name</Label>
                      <Input
                        id="company_name"
                        required
                        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                        placeholder="Acme Enterprises"
                        value={form.company_name}
                        onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="industry_slug" className="text-xs font-medium text-zinc-300">Industry Profile</Label>
                    <select
                      id="industry_slug"
                      className="flex h-11 w-full rounded-md border border-white/10 bg-[#0B0F19] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                      value={form.industry_slug}
                      onChange={(e) => setForm((f) => ({ ...f, industry_slug: e.target.value }))}
                    >
                      <option value="">Select your industry</option>
                      {ALL_INDUSTRIES.map((industry) => (
                        <option key={industry.slug} value={industry.slug} className="bg-[#0B0F19] text-white">
                          {industry.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="message" className="text-xs font-medium text-zinc-300">Key Operational Challenges</Label>
                    <textarea
                      id="message"
                      rows={3}
                      className="flex w-full rounded-md border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                      placeholder="e.g. Managing 3 branches, GST reconciliation, POS batch tracking..."
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    />
                  </div>

                  {status === "error" && <p className="text-xs text-rose-400 font-medium">{error}</p>}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-white shadow-[0_0_25px_rgba(124,58,237,0.4)] transition-all hover:scale-[1.01] hover:from-violet-500 hover:to-indigo-500"
                    disabled={status === "submitting"}
                  >
                    {status === "submitting" ? "Scheduling Architecture Walkthrough..." : "Schedule Architecture Walkthrough"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
