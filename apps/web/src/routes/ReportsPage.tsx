import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Table2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatINR } from "@/lib/format";

interface DatasetField { key: string; label: string }
interface DatasetInfo { key: string; label: string; group_by_options: DatasetField[]; metric_options: DatasetField[] }
interface ReportRow { group: string; value: string }
interface ReportResult { dataset: string; group_by: string; metric: string; rows: ReportRow[] }

export function ReportsPage() {
  const [datasetKey, setDatasetKey] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [metric, setMetric] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "chart">("table");

  const { data: datasets, isLoading: datasetsLoading, error: datasetsError } = useQuery({
    queryKey: ["report-datasets"],
    queryFn: () => apiFetch<DatasetInfo[]>("/reports/datasets"),
  });

  const activeDataset = datasets?.find((d) => d.key === datasetKey);

  useEffect(() => {
    if (!datasets || datasets.length === 0) return;
    if (!datasetKey || !datasets.some((d) => d.key === datasetKey)) {
      const first = datasets[0];
      setDatasetKey(first.key);
      setGroupBy(first.group_by_options[0]?.key ?? null);
      setMetric(first.metric_options[0]?.key ?? null);
    }
  }, [datasets, datasetKey]);

  function selectDataset(key: string) {
    const ds = datasets?.find((d) => d.key === key);
    setDatasetKey(key);
    setGroupBy(ds?.group_by_options[0]?.key ?? null);
    setMetric(ds?.metric_options[0]?.key ?? null);
  }

  const { data: result, isLoading: resultLoading, error: resultError } = useQuery({
    queryKey: ["report-run", datasetKey, groupBy, metric],
    queryFn: () =>
      apiFetch<ReportResult>(
        `/reports/run?dataset=${encodeURIComponent(datasetKey!)}&group_by=${encodeURIComponent(groupBy!)}&metric=${encodeURIComponent(metric!)}`,
      ),
    enabled: !!datasetKey && !!groupBy && !!metric,
  });

  const chartData = useMemo(() => (result?.rows ?? []).map((r) => ({ group: r.group, value: Number(r.value) })), [result]);
  const metricLabel = activeDataset?.metric_options.find((m) => m.key === metric)?.label ?? "Value";
  const isCurrencyMetric = metric !== "count" && metric !== "qty_on_hand";

  function exportCsv() {
    if (!result || !activeDataset) return;
    const groupLabel = activeDataset.group_by_options.find((g) => g.key === result.group_by)?.label ?? "Group";
    downloadCsv(`${activeDataset.key}-${result.group_by}-${result.metric}.csv`, [
      [groupLabel, metricLabel],
      ...result.rows.map((r) => [r.group, r.value]),
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">Build a table or chart over a fixed set of real datasets -- pick what to group by and measure.</p>
        </div>
        {result && result.rows.length > 0 && (
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>

      {datasetsLoading && <Skeleton className="h-64" />}
      {datasetsError && <ErrorState error={datasetsError} />}

      {datasets && datasets.length === 0 && (
        <EmptyState icon={BarChart3} title="No reports available" description="Your role doesn't have view access to any reportable data yet." />
      )}

      {datasets && datasets.length > 0 && activeDataset && (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="space-y-1.5">
              <Label>Dataset</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={datasetKey ?? ""}
                onChange={(e) => selectDataset(e.target.value)}
              >
                {datasets.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Group by</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={groupBy ?? ""}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                {activeDataset.group_by_options.map((g) => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Measure</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={metric ?? ""}
                onChange={(e) => setMetric(e.target.value)}
              >
                {activeDataset.metric_options.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant={view === "table" ? "default" : "outline"} size="sm" className={view === "table" ? "bg-[#7C3AED] text-white hover:bg-[#6D28D9]" : ""} onClick={() => setView("table")}>
                <Table2 className="h-3.5 w-3.5" /> Table
              </Button>
              <Button variant={view === "chart" ? "default" : "outline"} size="sm" className={view === "chart" ? "bg-[#7C3AED] text-white hover:bg-[#6D28D9]" : ""} onClick={() => setView("chart")}>
                <BarChart3 className="h-3.5 w-3.5" /> Chart
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            {resultLoading && <Skeleton className="h-72" />}
            {resultError && <ErrorState error={resultError} />}
            {result && result.rows.length === 0 && (
              <EmptyState icon={BarChart3} title="No data" description="This dataset has no rows matching the current grouping yet." />
            )}
            {result && result.rows.length > 0 && view === "table" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">{activeDataset.group_by_options.find((g) => g.key === result.group_by)?.label}</th>
                      <th className="px-4 py-2 text-right font-medium">{metricLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.group} className="border-t border-[#E2E8F0]">
                        <td className="px-4 py-2">{r.group}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{isCurrencyMetric ? formatINR(r.value) : r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result && result.rows.length > 0 && view === "chart" && (
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="group" angle={-30} textAnchor="end" interval={0} height={60} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => (isCurrencyMetric ? formatINR(v) : v)} />
                    <Bar dataKey="value" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
