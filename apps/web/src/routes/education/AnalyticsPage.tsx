import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface Overview {
  total_active_students: number;
  attendance_pct_last_30_days: number | null;
  fee_collection_pct: number | null;
  fee_invoiced_total: string;
  fee_collected_total: string;
  library_books_issued: number;
  transport_students_assigned: number;
  transport_routes: number;
  hostel_occupancy_pct: number | null;
  hostel_occupied_beds: number;
  hostel_total_beds: number;
}
interface TrendPoint { date: string; attendance_pct: number; }
interface ClassRow { school_class_id: string; school_class_name: string; attendance_pct: number; }
interface FeeClassRow { school_class_id: string; school_class_name: string; invoiced: string; collected: string; }
interface Examination { id: string; name: string; }
interface ExamPerfRow { subject_id: string; subject_name: string; average_pct: number | null; students_marked: number; }
interface HomeworkRow { section_id: string; section_label: string; completion_pct: number; tracked_submissions: number; }

// Categorical slot 1 (blue), same as SalesTrendChart -- the one
// real precedent this app already has for a single time-series.
const TREND_COLOR = "#2a78d6";

// Status palette (fixed, never themed) -- same three steps
// ReceivablesChart already established for ageing severity, applied
// here to attendance/collection/performance health bands instead.
function statusColor(pct: number): string {
  if (pct >= 75) return "#0ca30c";
  if (pct >= 50) return "#fab219";
  return "#d03b3b";
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function PctTooltip({ active, payload, labelKey }: { active?: boolean; payload?: { payload: Record<string, unknown> }[]; labelKey: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{String(point[labelKey])}</p>
      <p className="font-semibold text-foreground">{String(point.value ?? point.attendance_pct ?? point.completion_pct ?? point.average_pct)}%</p>
    </div>
  );
}

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function StatusBarChart({ data, dataKey, labelKey }: { data: Record<string, unknown>[]; dataKey: string; labelKey: string }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid vertical={false} stroke="currentColor" className="text-border" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" axisLine={false} tickLine={false} width={40} domain={[0, 100]} />
        <Tooltip content={<PctTooltip labelKey={labelKey} />} cursor={{ fill: "currentColor", className: "text-accent", opacity: 0.5 }} />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((entry, i) => (
            <Cell key={i} fill={statusColor(Number(entry[dataKey]))} />
          ))}
          <LabelList dataKey={dataKey} position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 10, fill: "currentColor" }} className="text-muted-foreground" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** School Analytics (Phase 7): every number computed on read from the
 * same tables every other module in this vertical already writes --
 * no new tables, no cached rollups to drift out of sync. */
export function AnalyticsPage() {
  const [examinationId, setExaminationId] = useState<string | null>(null);

  const { data: overview, isLoading } = useQuery({ queryKey: ["analytics-overview"], queryFn: () => apiFetch<Overview>("/analytics/overview") });
  const { data: trend } = useQuery({ queryKey: ["analytics-attendance-trend"], queryFn: () => apiFetch<TrendPoint[]>("/analytics/attendance-trend?days=30") });
  const { data: byClass } = useQuery({ queryKey: ["analytics-attendance-by-class"], queryFn: () => apiFetch<ClassRow[]>("/analytics/attendance-by-class") });
  const { data: feeByClass } = useQuery({ queryKey: ["analytics-fee-by-class"], queryFn: () => apiFetch<FeeClassRow[]>("/analytics/fee-collection-by-class") });
  const { data: homework } = useQuery({ queryKey: ["analytics-homework"], queryFn: () => apiFetch<HomeworkRow[]>("/analytics/homework-completion") });
  const { data: examinations } = useQuery({ queryKey: ["examinations"], queryFn: () => apiFetch<Examination[]>("/examinations") });
  const activeExamId = examinationId ?? examinations?.[0]?.id ?? null;
  const { data: examPerf } = useQuery({
    queryKey: ["analytics-exam-performance", activeExamId],
    queryFn: () => apiFetch<ExamPerfRow[]>(`/analytics/exam-performance?examination_id=${activeExamId}`),
    enabled: !!activeExamId,
  });

  const feeCollectionByClass = (feeByClass ?? []).map((r) => ({
    school_class_name: r.school_class_name,
    collection_pct: Number(r.invoiced) > 0 ? Math.round((Number(r.collected) / Number(r.invoiced)) * 1000) / 10 : 0,
  }));

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">School Analytics</h1>
        <p className="text-sm text-muted-foreground">Real numbers, computed live from attendance, fees, exams, homework, library, transport, and hostel records.</p>
      </div>

      {overview && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile label="Active students" value={String(overview.total_active_students)} />
          <KpiTile label="Attendance (30d)" value={overview.attendance_pct_last_30_days !== null ? `${overview.attendance_pct_last_30_days}%` : "—"} />
          <KpiTile label="Fee collection" value={overview.fee_collection_pct !== null ? `${overview.fee_collection_pct}%` : "—"} sub={overview.fee_invoiced_total !== "0" ? `₹${Number(overview.fee_collected_total).toLocaleString("en-IN")} of ₹${Number(overview.fee_invoiced_total).toLocaleString("en-IN")}` : undefined} />
          <KpiTile label="Library books issued" value={String(overview.library_books_issued)} />
          <KpiTile label="Transport" value={String(overview.transport_students_assigned)} sub={`students on ${overview.transport_routes} route${overview.transport_routes === 1 ? "" : "s"}`} />
          <KpiTile label="Hostel occupancy" value={overview.hostel_occupancy_pct !== null ? `${overview.hostel_occupancy_pct}%` : "—"} sub={overview.hostel_total_beds > 0 ? `${overview.hostel_occupied_beds} of ${overview.hostel_total_beds} beds` : undefined} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Attendance trend (30 days)</CardTitle></CardHeader>
          <CardContent>
            {(!trend || trend.length === 0) && <p className="py-8 text-center text-sm text-muted-foreground">No attendance recorded yet.</p>}
            {trend && trend.length > 0 && (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attendance-trend-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TREND_COLOR} stopOpacity={0.1} />
                      <stop offset="100%" stopColor={TREND_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="currentColor" className="text-border" />
                  <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" axisLine={false} tickLine={false} minTickGap={32} />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" axisLine={false} tickLine={false} width={40} domain={[0, 100]} />
                  <Tooltip content={<PctTooltip labelKey="date" />} cursor={{ stroke: "currentColor", strokeWidth: 1, className: "text-border" }} />
                  <Area type="monotone" dataKey="attendance_pct" stroke={TREND_COLOR} strokeWidth={2} fill="url(#attendance-trend-fill)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Attendance by class (30 days)</CardTitle></CardHeader>
          <CardContent><StatusBarChart data={byClass ?? []} dataKey="attendance_pct" labelKey="school_class_name" /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Fee collection by class</CardTitle></CardHeader>
          <CardContent><StatusBarChart data={feeCollectionByClass} dataKey="collection_pct" labelKey="school_class_name" /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Exam performance by subject</CardTitle>
              <select className="flex h-8 rounded-md border border-input bg-background px-2 text-xs" value={activeExamId ?? ""} onChange={(e) => setExaminationId(e.target.value)}>
                {examinations?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {!activeExamId && <p className="py-8 text-center text-sm text-muted-foreground">No examinations yet.</p>}
            {activeExamId && <StatusBarChart data={(examPerf ?? []).filter((r) => r.average_pct !== null).map((r) => ({ subject_name: r.subject_name, average_pct: r.average_pct }))} dataKey="average_pct" labelKey="subject_name" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Homework completion by section</CardTitle></CardHeader>
          <CardContent><StatusBarChart data={homework ?? []} dataKey="completion_pct" labelKey="section_label" /></CardContent>
        </Card>
      </div>

      {overview?.total_active_students === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          <span>Add students and start marking attendance, fees, and exams to see real analytics here.</span>
        </div>
      )}
    </div>
  );
}
