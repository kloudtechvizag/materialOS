import { Link } from "react-router-dom";
import { Compass, Home, LayoutGrid, MessageCircleQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Seo } from "@/components/marketing/Seo";

/** Branded 404 (§134) -- shown for any URL that matches neither the
 * authenticated app's routes nor a known marketing route. */
export function NotFoundPage() {
  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 py-24 text-center text-white">
      <Seo title="Page Not Found" description="This page doesn't exist on MaterialOS." path="/404" />
      <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300">
        404 • Resource Not Located
      </span>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Page not found</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        The route you are navigating to does not exist or has been relocated to another workspace address.
      </p>
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        <Button variant="outline" className="justify-start rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20" asChild>
          <Link to="/"><Home className="mr-2 h-4 w-4 text-violet-400" /> Go to home</Link>
        </Button>
        <Button variant="outline" className="justify-start rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20" asChild>
          <Link to="/industries"><Compass className="mr-2 h-4 w-4 text-sky-400" /> Explore industries</Link>
        </Button>
        <Button variant="outline" className="justify-start rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20" asChild>
          <Link to="/features"><LayoutGrid className="mr-2 h-4 w-4 text-emerald-400" /> Explore features</Link>
        </Button>
        <Button variant="outline" className="justify-start rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20" asChild>
          <Link to="/book-demo"><MessageCircleQuestion className="mr-2 h-4 w-4 text-amber-400" /> Book a demo</Link>
        </Button>
      </div>
    </div>
  );
}
