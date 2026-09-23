import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock, Inbox, LayoutGrid, List, MoreHorizontal, Phone, Plus, Search, Target, TrendingUp, Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

import { EnquiryBoard } from "./enquiries/EnquiryBoard";
import { EnquiryDetailDrawer } from "./enquiries/EnquiryDetailDrawer";
import { LogEnquiryDrawer } from "./enquiries/LogEnquiryDrawer";
import {
  type AcademicYear, type AdmissionsSummary, type Branch, type Employee, type Enquiry,
  STATUS_LABEL, followUpUrgency,
} from "./enquiries/types";

type ViewMode = "table" | "board";
type StatusFilter = "all" | "open" | "contacted" | "application_started" | "converted" | "closed";

const PIPELINE_STAGES: { key: StatusFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "contacted", label: "Contacted" },
  { key: "application_started", label: "Application started" },
  { key: "converted", label: "Converted" },
  { key: "closed", label: "Not proceeding" },
];

function matchesStatusFilter(enquiry: Enquiry, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "application_started") return enquiry.has_application && enquiry.status !== "converted";
  return enquiry.status === filter;
}

export function AdmissionEnquiriesPage() {
  const queryClient = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [view, setView] = useState<ViewMode>("table");

  const { data: enquiries, isLoading, error, refetch } = useQuery({
    queryKey: ["admission-enquiries"],
    queryFn: () => apiFetch<Enquiry[]>("/admission-enquiries"),
  });
  const { data: summary } = useQuery({
    queryKey: ["admission-enquiries-summary"],
    queryFn: () => apiFetch<AdmissionsSummary>("/admission-enquiries/summary"),
  });
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => apiFetch<Employee[]>("/employees") });

  const markContacted = useMutation({
    mutationFn: (id: string) => apiFetch<Enquiry>(`/admission-enquiries/${id}`, { method: "PATCH", body: { status: "contacted" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries-summary"] });
    },
  });
  const closeEnquiry = useMutation({
    mutationFn: (id: string) => apiFetch<Enquiry>(`/admission-enquiries/${id}`, { method: "PATCH", body: { status: "closed" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries-summary"] });
    },
  });
  const reopenEnquiry = useMutation({
    mutationFn: (id: string) => apiFetch<Enquiry>(`/admission-enquiries/${id}`, { method: "PATCH", body: { status: "open" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["admission-enquiries-summary"] });
    },
  });

  const filtered = useMemo(() => {
    const rows = enquiries ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((e) => {
      if (!matchesStatusFilter(e, statusFilter)) return false;
      if (assignedFilter !== "all" && (assignedFilter === "unassigned" ? e.assigned_to_id !== null : e.assigned_to_id !== assignedFilter)) return false;
      if (!q) return true;
      return (
        e.student_name.toLowerCase().includes(q) ||
        e.guardian_name.toLowerCase().includes(q) ||
        (e.guardian_phone ?? "").includes(q) ||
        (e.desired_grade ?? "").toLowerCase().includes(q)
      );
    });
  }, [enquiries, search, statusFilter, assignedFilter]);

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all" || assignedFilter !== "all";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admissions</h1>
          <p className="text-sm text-muted-foreground">Capture interest, manage follow-ups, and convert prospective families into enrolled students.</p>
        </div>
        <Button onClick={() => setLogOpen(true)}>
          <Plus className="h-4 w-4" /> Log enquiry
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard icon={Users} color="violet" label="Total enquiries" value={String(summary.total_enquiries)} />
          <KpiCard icon={TrendingUp} color="sky" label="New this week" value={String(summary.new_enquiries)} />
          <KpiCard icon={CalendarClock} color="amber" label="Follow-ups due today" value={String(summary.follow_ups_due_today)} />
          <KpiCard icon={CalendarClock} color="orange" label="Overdue follow-ups" value={String(summary.overdue_follow_ups)} />
          <KpiCard icon={Target} color="emerald" label="Conversion rate" value={summary.conversion_rate_pct !== null ? `${summary.conversion_rate_pct}%` : "--"} />
        </div>
      )}

      {summary && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
          {PIPELINE_STAGES.map((stage) => {
            const count = summary.pipeline[stage.key === "application_started" ? "application_started" : stage.key] ?? 0;
            const active = statusFilter === stage.key;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => setStatusFilter(active ? "all" : stage.key)}
                className={cn(
                  "flex flex-1 min-w-[8rem] flex-col items-start gap-0.5 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-primary/50",
                  active && "border-primary bg-primary/5"
                )}
              >
                <span className="text-xs text-muted-foreground">{stage.label}</span>
                <span className="text-lg font-semibold">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search student, guardian, phone, grade..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All statuses</option>
          {PIPELINE_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
        >
          <option value="all">Everyone</option>
          <option value="unassigned">Unassigned</option>
          {employees?.map((e) => <option key={e.id} value={e.id}>{`${e.first_name} ${e.last_name}`.trim()}</option>)}
        </select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setAssignedFilter("all"); }}>
            Clear filters
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5">
          <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setView("table")}>
            <List className="h-4 w-4" /> Table
          </Button>
          <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" onClick={() => setView("board")}>
            <LayoutGrid className="h-4 w-4" /> Board
          </Button>
        </div>
      </div>

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {enquiries && enquiries.length === 0 && (
        <EmptyState icon={Inbox} title="No enquiries yet" description="Log a prospective family's enquiry to start tracking follow-up." actionLabel="Log enquiry" onAction={() => setLogOpen(true)} />
      )}

      {enquiries && enquiries.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={Search} title="No enquiries match these filters" description="Try a different search term or clear the filters to see everyone."
          actionLabel="Clear filters" onAction={() => { setSearch(""); setStatusFilter("all"); setAssignedFilter("all"); }}
        />
      )}

      {filtered.length > 0 && view === "board" && <EnquiryBoard enquiries={filtered} onSelect={setSelectedEnquiry} />}

      {filtered.length > 0 && view === "table" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Guardian</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Source</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Assigned to</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Follow-up</th>
                  <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((enquiry, i) => {
                  const urgency = followUpUrgency(enquiry, today);
                  return (
                    <tr
                      key={enquiry.id}
                      className={cn("cursor-pointer border-t border-border hover:bg-muted", i % 2 === 1 && "bg-muted/40")}
                      onClick={() => setSelectedEnquiry(enquiry)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{enquiry.student_name}</div>
                        <div className="text-xs text-muted-foreground">{enquiry.desired_grade ?? "Grade not specified"}</div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div>{enquiry.guardian_name}</div>
                        <div className="text-xs text-muted-foreground">{enquiry.guardian_phone ?? "No phone on file"}</div>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">{enquiry.source ?? <span className="text-muted-foreground">Not set</span>}</td>
                      <td className="hidden px-4 py-3 lg:table-cell">{enquiry.assigned_to_name ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={enquiry.status === "converted" ? "success" : enquiry.status === "closed" ? "destructive" : enquiry.status === "contacted" ? "secondary" : "outline"}>
                            {STATUS_LABEL[enquiry.status] ?? enquiry.status}
                          </Badge>
                          {enquiry.has_application && enquiry.status !== "converted" && <Badge variant="secondary">Application started</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {enquiry.follow_up_date ? (
                          <span className={cn(urgency === "overdue" && "font-medium text-destructive", urgency === "today" && "font-medium text-amber-600 dark:text-amber-400")}>
                            {new Date(enquiry.follow_up_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not scheduled</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedEnquiry(enquiry)}>View details</DropdownMenuItem>
                            {enquiry.status === "open" && (
                              <DropdownMenuItem onClick={() => markContacted.mutate(enquiry.id)}>
                                <Phone className="h-4 w-4" /> Mark contacted
                              </DropdownMenuItem>
                            )}
                            {(enquiry.status === "open" || enquiry.status === "contacted") && (
                              <DropdownMenuItem onClick={() => closeEnquiry.mutate(enquiry.id)}>Close enquiry</DropdownMenuItem>
                            )}
                            {enquiry.status === "closed" && (
                              <DropdownMenuItem onClick={() => reopenEnquiry.mutate(enquiry.id)}>Reopen</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LogEnquiryDrawer open={logOpen} onOpenChange={setLogOpen} branches={branches} employees={employees} />
      <EnquiryDetailDrawer enquiry={selectedEnquiry} employees={employees} years={years} onClose={() => setSelectedEnquiry(null)} />
    </div>
  );
}
