import { useState } from "react";
import {
  ShieldCheck,
  Database,
  Lock,
  Zap,
  Star,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Testimonial {
  quote: string;
  metric: string;
  metricLabel: string;
  author: string;
  title: string;
  company: string;
  industry: string;
  location: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "MaterialOS cut our vehicle dispatch turnaround from 3 hours down to 18 minutes. For a dealer handling 50 tons of TMT steel daily, having live credit limits right at order entry stopped ₹18L in defaults this quarter alone.",
    metric: "18 Minutes",
    metricLabel: "Dispatch Turnaround (vs 3 Hours)",
    author: "Balaji V.",
    title: "Managing Director",
    company: "Sri Balaji Building Materials Pvt Ltd",
    industry: "Building Materials & Steel",
    location: "Visakhapatnam, AP",
  },
  {
    quote:
      "The FEFO batch expiry quarantine is absolute genius. In retail pharmacy, expired stock used to be a silent 2% margin write-off. MaterialOS automatically flags 30-day windows and handles supplier debit notes seamlessly.",
    metric: "0% Expired Stock",
    metricLabel: "Loss Prevention Reached",
    author: "Dr. K. Srinivas",
    title: "Chief Pharmacist & Founder",
    company: "Srinivasa Care Pharma Network",
    industry: "Pharmacy & Retail Health",
    location: "Hyderabad, TS",
  },
  {
    quote:
      "Managing 13 stages across 4 offset presses and 2 digital color labs was pure whiteboards and WhatsApp chaos. MaterialOS gives our prepress and finishing operators a live, color-coded Kanban board that never drops a deadline.",
    metric: "94.2% On-Time",
    metricLabel: "Pressroom Delivery Rate",
    author: "Anand M.",
    title: "Operations Head",
    company: "ColorPrint & Packaging Works",
    industry: "Printing Press & Packaging",
    location: "Vijayawada, AP",
  },
  {
    quote:
      "Collecting term fees from 1,400 students across 3 school branches used to take two full-time accountants 3 weeks every quarter. With MaterialOS automated fee schedules and UPI links, 88% of payments arrive before the due date.",
    metric: "₹42.8 Lakh",
    metricLabel: "Collected in 72 Hours",
    author: "Sujatha R.",
    title: "Administrative Director",
    company: "Aditya Educational Academy",
    industry: "School Management / ERP",
    location: "Bengaluru, KA",
  },
];

export function EnterpriseTrustStrip() {
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  function prev() {
    setActiveTestimonial((curr) => (curr === 0 ? TESTIMONIALS.length - 1 : curr - 1));
  }

  function next() {
    setActiveTestimonial((curr) => (curr === TESTIMONIALS.length - 1 ? 0 : curr + 1));
  }

  const current = TESTIMONIALS[activeTestimonial];

  return (
    <section className="relative bg-[#070B14] py-20 text-white border-t border-white/5">
      <div className="mx-auto max-w-6xl px-6 space-y-16">
        {/* Trust & Compliance Badge Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-2 hover:border-emerald-500/40 hover:bg-white/[0.04] transition-all">
            <div className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Statutory Compliant</span>
            </div>
            <h4 className="text-base font-bold text-white">GST & E-Invoicing 2026</h4>
            <p className="text-xs text-zinc-400">
              Direct NIC / IRP API connectivity with IRN generation, E-Way Bill auto-sync, and Tally XML export.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-2 hover:border-sky-500/40 hover:bg-white/[0.04] transition-all">
            <div className="flex items-center gap-2 text-sky-400">
              <Database className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Bank-Grade Isolation</span>
            </div>
            <h4 className="text-base font-bold text-white">PostgreSQL RLS Security</h4>
            <p className="text-xs text-zinc-400">
              Strict database row-level security ensuring zero cross-tenant leakage across multi-company workspaces.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-2 hover:border-violet-500/40 hover:bg-white/[0.04] transition-all">
            <div className="flex items-center gap-2 text-violet-400">
              <Lock className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Zero Lock-In</span>
            </div>
            <h4 className="text-base font-bold text-white">Full Data Portability</h4>
            <p className="text-xs text-zinc-400">
              Automated daily backups with 1-click JSON, CSV, and Excel exports of all customer and accounting records.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-2 hover:border-amber-500/40 hover:bg-white/[0.04] transition-all">
            <div className="flex items-center gap-2 text-amber-400">
              <Zap className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Lightning Performance</span>
            </div>
            <h4 className="text-base font-bold text-white">&lt; 100ms API Response</h4>
            <p className="text-xs text-zinc-400">
              Engineered with FastAPI, Redis cache invalidation, and Rust-accelerated compilation toolchain.
            </p>
          </div>
        </div>

        {/* Client Testimonial Carousel */}
        <div className="rounded-3xl border border-white/10 bg-[#0C111E] p-8 sm:p-12 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-1.5 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-2 text-xs font-semibold text-zinc-400">Verified Operator Review</span>
              </div>

              <blockquote className="text-lg sm:text-2xl font-medium text-white leading-relaxed">
                &ldquo;{current.quote}&rdquo;
              </blockquote>

              <div className="pt-2">
                <div className="font-bold text-white text-base">{current.author}</div>
                <div className="text-xs text-zinc-400">
                  {current.title} · <span className="text-violet-400 font-medium">{current.company}</span>
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  {current.industry} · {current.location}
                </div>
              </div>
            </div>

            {/* Impact Metric & Controls */}
            <div className="shrink-0 flex flex-col items-start lg:items-end justify-between gap-6 border-t lg:border-t-0 lg:border-l border-white/10 pt-6 lg:pt-0 lg:pl-10">
              <div className="lg:text-right space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Verified Impact</span>
                <div className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">{current.metric}</div>
                <p className="text-xs text-zinc-400">{current.metricLabel}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={prev}
                  aria-label="Previous testimonial"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="px-2 text-xs font-mono text-zinc-500">
                  {activeTestimonial + 1} / {TESTIMONIALS.length}
                </div>
                <button
                  onClick={next}
                  aria-label="Next testimonial"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
