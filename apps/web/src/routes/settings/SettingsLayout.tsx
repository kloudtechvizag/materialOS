import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";

import { apiFetch } from "@/lib/api";
import { useIndustryProfile } from "@/lib/industryProfile";
import { buildSettingsNav } from "@/lib/settingsNav";
import { cn } from "@/lib/utils";

interface CurrentUserPermissions {
  permissions: string[];
}

/** The one Settings workspace (ADR-048) -- a shared layout route
 * (`/settings/*`) whose secondary nav is built the same way the main
 * sidebar is (profile + real permissions, buildSettingsNav mirrors
 * lib/navigation.ts's own buildNavigation), and whose content area is
 * an <Outlet> rendering the exact same page component each settings
 * route already used standalone -- no settings screen was duplicated
 * or rebuilt to make this workspace exist. */
export function SettingsLayout() {
  const { profile } = useIndustryProfile();
  const { data: me } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => apiFetch<CurrentUserPermissions>("/auth/me"),
    staleTime: Infinity,
  });
  const categories = useMemo(
    () => buildSettingsNav(profile?.enabled_modules, me?.permissions),
    [profile, me]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {profile ? `${profile.name} configuration, your organization, and your MaterialOS account.` : "Organization and account configuration."}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav aria-label="Settings" className="shrink-0 lg:w-56">
          <div className="flex gap-4 overflow-x-auto pb-2 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-0">
            {categories.map((category) => (
              <div key={category.id} className="shrink-0 lg:shrink">
                <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category.label}</p>
                <div className="flex gap-1 lg:flex-col">
                  {category.items.map((item) => (
                    <NavLink
                      key={item.id}
                      to={item.href}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition-colors",
                          isActive ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
