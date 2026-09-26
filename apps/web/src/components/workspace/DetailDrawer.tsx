import type { ReactNode } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export interface DetailDrawerMetric {
  label: string;
  value: ReactNode;
}

export interface DetailDrawerSection {
  title: string;
  content: ReactNode;
}

export interface DetailDrawerProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  statusBadge?: {
    label: string;
    variant?: "default" | "secondary" | "outline" | "destructive" | "success";
  };
  metrics?: DetailDrawerMetric[];
  sections?: DetailDrawerSection[];
  fullRecordHref?: string;
  fullRecordLabel?: string;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    disabled?: boolean;
    variant?: "default" | "destructive" | "secondary";
  };
  actions?: ReactNode;
  children?: ReactNode;
}

export function DetailDrawer({
  open,
  isOpen,
  onOpenChange,
  onClose,
  title,
  subtitle,
  badge,
  statusBadge,
  metrics = [],
  sections = [],
  fullRecordHref,
  fullRecordLabel = "Open full record",
  primaryAction,
  actions,
  children,
}: DetailDrawerProps) {
  const isDrawerOpen = isOpen ?? open ?? false;
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && onClose) {
      onClose();
    }
    onOpenChange?.(nextOpen);
  };
  return (
    <Drawer open={isDrawerOpen} onOpenChange={handleOpenChange}>
      <DrawerContent className="sm:max-w-xl">
        <DrawerHeader className="border-b border-border/40 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DrawerTitle className="text-xl font-bold tracking-tight">
                  {title}
                </DrawerTitle>
                {statusBadge && (
                  <Badge variant={statusBadge.variant ?? "outline"}>
                    {statusBadge.label}
                  </Badge>
                )}
                {badge && (typeof badge === "string" ? <Badge variant="outline">{badge}</Badge> : badge)}
              </div>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleOpenChange(false)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <DrawerBody className="space-y-5 py-5 overflow-y-auto max-h-[calc(100vh-14rem)]">
          {/* Quick Metrics Strip in Drawer */}
          {metrics.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-3">
              {metrics.map((m, i) => (
                <div key={i} className="space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {m.label}
                  </span>
                  <div className="text-sm font-semibold text-foreground">{m.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Structured Sections */}
          {sections.map((sec, i) => (
            <div key={i} className="space-y-2 border-t border-border/40 pt-4 first:border-t-0 first:pt-0">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {sec.title}
              </h4>
              <div>{sec.content}</div>
            </div>
          ))}

          {children}
        </DrawerBody>

        {(primaryAction || fullRecordHref || actions) && (
          <DrawerFooter className="border-t border-border/40 pt-3">
            <div className="flex w-full items-center justify-between gap-2">
              <div>
                {fullRecordHref && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={fullRecordHref} onClick={() => handleOpenChange(false)}>
                      <span>{fullRecordLabel}</span>
                      <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                >
                  Close
                </Button>
                {actions}
                {primaryAction && (
                  primaryAction.href ? (
                    <Button asChild size="sm" variant={primaryAction.variant ?? "default"}>
                      <Link to={primaryAction.href} onClick={() => handleOpenChange(false)}>
                        {primaryAction.label}
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant={primaryAction.variant ?? "default"}
                      onClick={primaryAction.onClick}
                      disabled={primaryAction.disabled}
                    >
                      {primaryAction.label}
                    </Button>
                  )
                )}
              </div>
            </div>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
