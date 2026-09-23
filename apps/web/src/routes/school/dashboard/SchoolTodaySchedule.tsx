import { Link } from "react-router-dom";
import { CalendarDays, ClipboardList } from "lucide-react";

import type { TodayScheduleItem } from "./types";

/** Real exams (ExamSubjectSchedule.exam_date == today) and real
 * timetable periods for today, chronologically merged -- capped to the
 * backend's own top-12-by-time slice with a link to the full
 * timetable for the rest, never a fabricated agenda (no meeting/event
 * calendar model exists yet -- named as deferred in ADR-046). */
export function SchoolTodaySchedule({
  items, totalClasses, isLoading, hasAnyPermission,
}: {
  items: TodayScheduleItem[] | undefined;
  totalClasses: number | null | undefined;
  isLoading: boolean;
  hasAnyPermission: boolean;
}) {
  const shown = items ?? [];
  const hiddenClassCount = totalClasses !== null && totalClasses !== undefined ? Math.max(0, totalClasses - shown.filter((i) => i.category === "class").length) : 0;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Today at school</p>
        {shown.some((i) => i.category === "class") && (
          <Link to="/timetable" className="text-xs font-medium text-primary hover:underline">
            View full timetable &rarr;
          </Link>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && !hasAnyPermission && (
        <p className="text-sm text-muted-foreground">You don&apos;t have permission to view today&apos;s schedule.</p>
      )}

      {!isLoading && hasAnyPermission && shown.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>Nothing scheduled today.</span>
        </div>
      )}

      {!isLoading && shown.length > 0 && (
        <div className="space-y-1.5">
          {shown.map((item, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm">
              <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">{item.time ?? "All day"}</span>
              {item.category === "exam" ? <ClipboardList className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" /> : <CalendarDays className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />}
              <span className="truncate">
                {item.title}
                {item.detail && <span className="text-muted-foreground"> &middot; {item.detail}</span>}
              </span>
            </div>
          ))}
          {hiddenClassCount > 0 && (
            <p className="px-2 pt-1 text-xs text-muted-foreground">+{hiddenClassCount} more period{hiddenClassCount === 1 ? "" : "s"} today &mdash; see the full timetable.</p>
          )}
        </div>
      )}
    </div>
  );
}
