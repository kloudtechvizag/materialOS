import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" | "success" }
> = {
  // Common states
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "outline" },
  draft: { label: "Draft", variant: "outline" },
  pending: { label: "Pending", variant: "secondary" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  completed: { label: "Completed", variant: "success" },
  archived: { label: "Archived", variant: "outline" },

  // Orders / Sales / Procurement
  reserved: { label: "Awaiting dispatch", variant: "secondary" },
  dispatched: { label: "Dispatched", variant: "secondary" },
  invoiced: { label: "Invoiced", variant: "success" },
  credit_hold: { label: "Credit hold", variant: "destructive" },
  partially_received: { label: "Partially received", variant: "secondary" },
  received: { label: "Received", variant: "success" },
  billed: { label: "Billed", variant: "success" },

  // Expiry / Inventory
  expiring_soon: { label: "Expiring soon", variant: "secondary" },
  expired: { label: "Expired", variant: "destructive" },
  low_stock: { label: "Low stock", variant: "destructive" },

  // LIMS
  accessioned: { label: "Accessioned", variant: "secondary" },
  in_testing: { label: "In testing", variant: "secondary" },
  qc_failed: { label: "QC Failed", variant: "destructive" },
  verified: { label: "Verified", variant: "success" },
  published: { label: "Published", variant: "success" },

  // Printing
  waiting_artwork: { label: "Waiting artwork", variant: "secondary" },
  artwork_approved: { label: "Artwork approved", variant: "outline" },
  in_production: { label: "In production", variant: "secondary" },
  finishing: { label: "Finishing", variant: "secondary" },
  ready_dispatch: { label: "Ready to dispatch", variant: "success" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const normalized = status.toLowerCase().replace(/[-\s]/g, "_");
  const cfg = STATUS_CONFIG[normalized] ?? {
    label: label ?? status.replace(/_/g, " "),
    variant: "outline",
  };

  return (
    <Badge
      variant={cfg.variant}
      className={cn("capitalize font-medium text-[11px] whitespace-nowrap", className)}
    >
      {label ?? cfg.label}
    </Badge>
  );
}
