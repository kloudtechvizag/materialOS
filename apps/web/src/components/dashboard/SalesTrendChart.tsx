import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR, formatINRCompact } from "@/lib/format";

interface TrendPoint {
  date: string;
  total: string;
}

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

// Categorical slot 1 (blue) from the palette -- a single series needs
// no legend, just one consistent, dual-mode-validated color.
const SERIES_COLOR = "#2a78d6";

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function TooltipContent({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{formatDateShort(point.date)}</p>
      <p className="font-semibold text-foreground">{formatINR(point.total)}</p>
    </div>
  );
}

/** Real per-day posted-invoice totals (GET /dashboard/sales-trend) --
 * the first time-series chart this app has needed. Only rendered for
 * profiles with "accounting" enabled (every profile except laboratory
 * genuinely posts invoices -- see ADR-024). */
export function SalesTrendChart() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sales-trend", days],
    queryFn: () => apiFetch<TrendPoint[]>(`/dashboard/sales-trend?days=${days}`),
  });

  const total = data?.reduce((sum, p) => sum + Number(p.total), 0) ?? 0;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Sales &amp; revenue trend</p>
          <p className="text-xs text-muted-foreground">
            {data ? `${formatINR(total)} invoiced` : " "} in the last {days} days
          </p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Button key={r.days} size="sm" variant={days === r.days ? "default" : "outline"} onClick={() => setDays(r.days)}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <Skeleton className="h-56 w-full" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && data.every((p) => Number(p.total) === 0) && (
        <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <p>No posted invoices in this range yet.</p>
          <Button asChild size="sm" variant="outline">
            <Link to="/quotations/new">New quotation</Link>
          </Button>
        </div>
      )}

      {data && data.some((p) => Number(p.total) > 0) && (
        <ResponsiveContainer width="100%" height={224}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="sales-trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.1} />
                <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="currentColor" className="text-border" strokeDasharray="0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-muted-foreground"
              axisLine={false}
              tickLine={false}
              minTickGap={32}
            />
            <YAxis
              tickFormatter={(v) => formatINRCompact(v)}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-muted-foreground"
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={<TooltipContent />} cursor={{ stroke: "currentColor", strokeWidth: 1, className: "text-border" }} />
            <Area type="monotone" dataKey="total" stroke={SERIES_COLOR} strokeWidth={2} fill="url(#sales-trend-fill)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
