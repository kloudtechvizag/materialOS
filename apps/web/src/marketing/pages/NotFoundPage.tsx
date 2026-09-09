import { Link } from "react-router-dom";
import { Compass, Home, LayoutGrid, MessageCircleQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Seo } from "@/components/marketing/Seo";

/** Branded 404 (§134) -- shown for any URL that matches neither the
 * authenticated app's routes nor a known marketing route. */
export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <Seo title="Page Not Found" description="This page doesn't exist on MaterialOS." path="/404" />
      <p className="text-sm font-semibold uppercase tracking-wide text-[#7C3AED]">404</p>
      <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
      <p className="mt-3 text-muted-foreground">The page you're looking for doesn't exist or may have moved.</p>
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        <Button variant="outline" className="justify-start" asChild>
          <Link to="/"><Home className="h-4 w-4" /> Go home</Link>
        </Button>
        <Button variant="outline" className="justify-start" asChild>
          <Link to="/industries"><Compass className="h-4 w-4" /> Explore industries</Link>
        </Button>
        <Button variant="outline" className="justify-start" asChild>
          <Link to="/features"><LayoutGrid className="h-4 w-4" /> Explore features</Link>
        </Button>
        <Button variant="outline" className="justify-start" asChild>
          <Link to="/book-demo"><MessageCircleQuestion className="h-4 w-4" /> Book a demo</Link>
        </Button>
      </div>
    </div>
  );
}
