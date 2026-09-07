import { cn } from "@/lib/utils";

/** G96: skeletons instead of blank screens; sections load independently. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
