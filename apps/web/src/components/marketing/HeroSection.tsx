import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Play, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection({ onExploreDemo }: { onExploreDemo?: () => void }) {
  return (
    <section className="relative overflow-hidden bg-[#070B14] pb-20 pt-16 text-white sm:pb-28 sm:pt-24">
      {/* Ambient background glows & mesh grid */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[550px] w-[900px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.28)_0%,rgba(59,130,246,0.12)_45%,transparent_75%)] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        {/* Floating Pill Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-300 backdrop-blur-md transition-all hover:border-violet-500/50 hover:bg-violet-500/20">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-white">MaterialOS 2.0</span>
          <span className="text-white/40">•</span>
          <span>AI-Native Operating System for 26 Industries</span>
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
        </div>

        {/* Main Headline */}
        <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.15]">
          The Intelligent Operating System Behind{" "}
          <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
            Next-Generation
          </span>{" "}
          Businesses.
        </h1>

        {/* Value Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-300 sm:text-xl sm:leading-relaxed">
          Eliminate disconnected ERPs, manual ledgers, and billing chaos. From quotation to collection, stock rebalancing
          to statutory GST compliance — MaterialOS unifies your entire business into one real-time actionable workspace.
        </p>

        {/* Primary Action Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button
            size="lg"
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-6 text-base font-semibold text-white shadow-[0_0_30px_-5px_rgba(124,58,237,0.5)] transition-all duration-300 hover:scale-[1.02] hover:from-violet-500 hover:to-indigo-500"
            asChild
          >
            <Link to="/signup">
              Start Free 14-Day Trial
              <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={onExploreDemo}
            className="rounded-xl border-white/15 bg-white/5 px-7 py-6 text-base font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/30"
          >
            <Play className="mr-2 h-4 w-4 fill-white text-white" />
            Explore Live Sandbox
          </Button>
        </div>

        {/* Trust Proof Strip */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Instant seeded workspace</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-sky-400" />
            <span>100% GST & E-Invoicing Compliant</span>
          </div>
        </div>
      </div>
    </section>
  );
}
