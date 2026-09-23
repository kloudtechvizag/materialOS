import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useIndustryProfile } from "@/lib/industryProfile";

import { SchoolAcademicSnapshot, SchoolStaffSnapshot } from "./dashboard/SchoolAcademicStaffSnapshot";
import { SchoolAdmissionsSnapshot } from "./dashboard/SchoolAdmissionsSnapshot";
import { SchoolFeeSnapshot } from "./dashboard/SchoolFeeSnapshot";
import { SchoolKpiGrid } from "./dashboard/SchoolKpiGrid";
import { SchoolNeedsAttention } from "./dashboard/SchoolNeedsAttention";
import { SCHOOL_QUICK_ACTIONS, SchoolQuickActions } from "./dashboard/SchoolQuickActions";
import { SchoolTodaySchedule } from "./dashboard/SchoolTodaySchedule";
import type { SchoolDashboardSummary } from "./dashboard/types";

interface CurrentUser { full_name: string; }
interface Branch { id: string; name: string; }
interface AcademicYear { id: string; name: string; is_current: boolean; }

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** School Command Center (ADR-046) -- a dedicated tree for the
 * school_education profile, not a branch inside the generic trade
 * DashboardPage (see DashboardPage.tsx's own early-return): the
 * generic dashboard's flat DASHBOARD_WIDGETS registry and single
 * /dashboard/summary shape were built for KPI tiles only, and every
 * other industry profile keeps using that path completely unchanged. */
export function SchoolDashboardPage() {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState("");
  const { companyName } = useIndustryProfile();

  const { data: me } = useQuery({ queryKey: ["current-user"], queryFn: () => apiFetch<CurrentUser>("/auth/me"), staleTime: Infinity });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });
  const { data: academicYears } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const currentYear = academicYears?.find((y) => y.is_current);

  const qs = branchId ? `?branch_id=${branchId}` : "";
  const { data, isLoading, error, refetch, isRefetching, dataUpdatedAt } = useQuery({
    queryKey: ["school-dashboard-summary", branchId],
    queryFn: () => apiFetch<SchoolDashboardSummary>(`/school-dashboard/summary${qs}`),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {me ? `${greeting()}, ${me.full_name.split(" ")[0]}.` : "School dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening at {companyName ?? "your school"} today.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            {currentYear && <span>&middot; {currentYear.name}</span>}
            <span>&middot; Updated {timeAgo(dataUpdatedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {branches && branches.length > 1 && (
            <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">All campuses</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <Button
            variant="outline" size="icon" aria-label="Refresh dashboard"
            onClick={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
            }}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                + Create <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SCHOOL_QUICK_ACTIONS.map((action) => (
                <DropdownMenuItem key={action.key} asChild>
                  <Link to={action.href}>
                    <action.icon className="h-4 w-4" /> {action.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && (
        <>
          <SchoolKpiGrid kpis={data.kpis} />

          <div className="grid gap-4 lg:grid-cols-2">
            <SchoolNeedsAttention items={data.needs_attention} isLoading={false} />
            <SchoolTodaySchedule
              items={data.today_schedule}
              totalClasses={data.today_schedule_total_classes}
              isLoading={false}
              hasAnyPermission={data.academic !== null}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SchoolAdmissionsSnapshot pipeline={data.admissions_pipeline} isLoading={false} />
            <SchoolFeeSnapshot fees={data.fees} isLoading={false} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SchoolAcademicSnapshot academic={data.academic} isLoading={false} />
            <SchoolStaffSnapshot staff={data.staff} isLoading={false} />
          </div>

          <SchoolQuickActions />
        </>
      )}

      {!isLoading && <RecentActivity />}
    </div>
  );
}
