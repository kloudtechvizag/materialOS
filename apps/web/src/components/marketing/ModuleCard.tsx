import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

type IconComponent = React.ComponentType<{ className?: string }>;

interface ModuleCardProps {
  icon: IconComponent;
  gradient: { from: string; to: string };
  name: string;
  tagline: string;
  screenshot?: string;
  to?: string;
  size?: "hero" | "standard";
  className?: string;
}

/** Bento-grid card for the marketing site's module/feature/industry
 * grids (ProductOverviewPage, HomePage) -- soft shadow + low-opacity
 * border instead of a flat grey outline, gradient icon badge, and a
 * real product screenshot (never fabricated) floating in its own
 * shadowed tray rather than a flush footer strip. `size="hero"` is for
 * the 2-column-span highlight cells in a bento layout; everything else
 * stays "standard". Renders as a Link when `to` is given (an
 * itemwith a real detail page), otherwise a plain div (e.g. "Also
 * included" items that have no dedicated page). */
export function ModuleCard({ icon: Icon, gradient, name, tagline, screenshot, to, size = "standard", className }: ModuleCardProps) {
  const isHero = size === "hero";

  const content = (
    <>
      <div className={cn("flex flex-col", isHero ? "p-7 sm:p-8" : "p-6")}>
        <div
          className={cn("flex items-center justify-center rounded-xl shadow-[0_4px_12px_-2px_rgba(0,0,0,0.25)]", isHero ? "h-14 w-14" : "h-12 w-12")}
          style={{ backgroundImage: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
        >
          <Icon className={cn("text-white", isHero ? "h-7 w-7" : "h-6 w-6")} />
        </div>
        <h3 className={cn("mt-4 font-semibold tracking-tight text-foreground", isHero ? "text-xl" : "text-base")}>{name}</h3>
        <p className={cn("mt-1.5 text-muted-foreground", isHero ? "text-[15px] leading-relaxed" : "text-sm leading-relaxed")}>{tagline}</p>
        {to && (
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#7C3AED] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Learn more <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        )}
      </div>
      {screenshot && (
        <div className={cn("px-5 pb-5 sm:px-6 sm:pb-6", isHero ? "mt-1" : "mt-0")}>
          <div
            className={cn(
              "overflow-hidden rounded-xl shadow-[0_20px_45px_-20px_rgba(0,0,0,0.35)] ring-1 ring-black/5",
              isHero ? "h-48 sm:h-56" : "h-28",
            )}
          >
            <img
              src={screenshot}
              alt=""
              className="h-full w-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </>
  );

  const cardClassName = cn(
    "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.05)] transition-all duration-300",
    to && "hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(15,23,42,0.10)]",
    className,
  );

  if (to) {
    return (
      <Link to={to} className={cardClassName}>
        {content}
      </Link>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}
