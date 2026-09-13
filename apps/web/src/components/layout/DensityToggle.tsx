import { Check, Rows2, Rows3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type Density, useDensityStore } from "@/store/density";

const OPTIONS: { density: Density; label: string; description: string; icon: typeof Rows2 }[] = [
  { density: "comfortable", label: "Comfortable", description: "More breathing room", icon: Rows2 },
  { density: "compact", label: "Compact", description: "Higher information density", icon: Rows3 },
];

/** Comfortable/Compact picker -- mounted in AppShell's header next to
 * ThemeToggle. Real effect: table row height and Button/Input default
 * sizing everywhere (index.css's --control-h/--table-cell-py), not a
 * per-page setting each list page has to opt into separately. */
export function DensityToggle() {
  const density = useDensityStore((s) => s.density);
  const setDensity = useDensityStore((s) => s.setDensity);
  const ActiveIcon = OPTIONS.find((o) => o.density === density)?.icon ?? Rows2;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Change density">
          <ActiveIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {OPTIONS.map((option) => (
          <DropdownMenuItem key={option.density} onClick={() => setDensity(option.density)}>
            <option.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              <span className="block">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.description}</span>
            </span>
            {density === option.density && <Check className="h-3.5 w-3.5 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
