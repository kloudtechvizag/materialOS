import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR, formatINRCompact } from "@/lib/format";

interface AgeingLine {
  bucket: string;
  amount_due: string;
}

const BUCKET_ORDER = ["current", "1-15", "16-30", "31-45", "46+"];
const BUCKET_LABEL: Record<string, string> = {
  current: "Current", "1-15": "1–15d", "16-30": "16–30d", "31-45": "31–45d", "46+": "46d+",
};
// Status palette (fixed, never themed) -- ageing buckets are a real
// severity scale, not arbitrary categories, so they read as good ->
// warning -> serious -> critical rather than a cycled categorical hue.
const BUCKET_COLOR: Record<string, string> = {
  current: "#0ca30c", "1-15": "#fab219", "16-30": "#fab219", "31-45": "#ec835a", "46+": "#d03b3b",
};

function TooltipContent({ active, payload }: { active?: boolean; payload?: { payload: { bucket: string; total: number } }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const { bucket, total } = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{BUCKET_LABEL[bucket] ?? bucket}</p>
      <p className="font-semibold text-foreground">{formatINR(total)}</p>
    </div>
  );
}

/** Real per-invoice ageing (GET /collections/ageing, already built for
 * the Collections page) rolled up by bucket -- no new backend needed.
 * Only rendered for profiles with "collections" enabled. */
export function ReceivablesChart() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["collections-ageing"],
    queryFn: () => apiFetch<AgeingLine[]>("/collections/ageing"),
  });

  const byBucket = new Map<string, number>();
  for (const line of data ?? []) {
    byBucket.set(line.bucket, (byBucket.get(line.bucket) ?? 0) + Number(line.amount_due));
  }
  const chartData = BUCKET_ORDER.map((bucket) => ({ bucket, total: byBucket.get(bucket) ?? 0 }));
  const totalOutstanding = chartData.reduce((sum, b) => sum + b.total, 0);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Receivables by age</p>
          <p className="text-xs text-muted-foreground">{data ? `${formatINR(totalOutstanding)} outstanding` : " "}</p>
        </div>
        <Link to="/collections" className="text-xs font-medium text-primary hover:underline">
          View collections
        </Link>
      </div>

      {isLoading && <Skeleton className="h-56 w-full" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && totalOutstanding === 0 && (
        <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          <p>Every posted invoice is fully collected.</p>
        </div>
      )}

      {data && totalOutstanding > 0 && (
        <ResponsiveContainer width="100%" height={224}>
          <BarChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="currentColor" className="text-border" />
            <XAxis
              dataKey="bucket"
              tickFormatter={(b) => BUCKET_LABEL[b] ?? b}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-muted-foreground"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatINRCompact(v)}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-muted-foreground"
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={<TooltipContent />} cursor={{ fill: "currentColor", className: "text-accent", opacity: 0.5 }} />
            <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {chartData.map((entry) => (
                <Cell key={entry.bucket} fill={BUCKET_COLOR[entry.bucket]} />
              ))}
              <LabelList
                dataKey="total"
                position="top"
                formatter={(v: number) => (v > 0 ? formatINRCompact(v) : "")}
                style={{ fontSize: 10, fill: "currentColor" }}
                className="text-muted-foreground"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
