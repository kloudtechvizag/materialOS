import { Package } from "lucide-react";

import { useAuthenticatedImage } from "@/lib/useAuthenticatedImage";
import { cn } from "@/lib/utils";

/** Real item photo when one's been uploaded (see ADR-019 -- never a
 * generic stock photo), otherwise a plain icon tile -- consistent with
 * EmptyState's own icon-based convention rather than an illustration or
 * a blank box. `itemId` of null/undefined (a not-yet-saved item) skips
 * the fetch entirely. `imagePath` is the item's own image_path field --
 * passed through purely as a cache key so a re-upload (same itemId,
 * new image_path) actually triggers a refetch; see
 * useAuthenticatedImage's own doc comment. */
export function ItemImage({
  itemId,
  imagePath,
  alt,
  className,
}: {
  itemId: string | null | undefined;
  imagePath: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const url = useAuthenticatedImage(itemId ? `/items/${itemId}/image` : null, imagePath);

  if (url) {
    return <img src={url} alt={alt} className={cn("object-cover", className)} />;
  }

  return (
    <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
      <Package className="h-1/2 w-1/2" strokeWidth={1.5} />
    </div>
  );
}
