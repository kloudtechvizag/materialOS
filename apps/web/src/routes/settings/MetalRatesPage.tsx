import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface MetalRate {
  id: string;
  metal: string;
  purity: string;
  rate_per_gram: string;
  effective_date: string;
}

const TODAY = new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { metal: "gold", purity: "22K", rate_per_gram: "", effective_date: TODAY };

/** Jewellery's pricing_strategy ("weight_making_wastage") reads the
 * most recent row here for an item's metal+purity (services/pricing.py)
 * -- there is no live gold-rate feed integrated, so a shop enters its
 * own day rate here, the same way every real jewellery billing product
 * works. Saving the same metal+purity+day again corrects that day's
 * rate in place rather than creating a duplicate. */
export function MetalRatesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: rates, isLoading, error, refetch } = useQuery({
    queryKey: ["metal-rates"],
    queryFn: () => apiFetch<MetalRate[]>("/metal-rates"),
  });

  const saveRate = useMutation({
    mutationFn: () => apiFetch<MetalRate>("/metal-rates", { method: "POST", body: { ...form, rate_per_gram: form.rate_per_gram } }),
    onSuccess: () => {
      setForm((f) => ({ ...f, rate_per_gram: "" }));
      queryClient.invalidateQueries({ queryKey: ["metal-rates"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Metal rates</h1>
        <p className="text-sm text-muted-foreground">
          Today's rate per gram, entered by you -- item prices for weight-priced jewellery are computed from whichever
          rate below is most recent for that metal and purity.
        </p>
      </div>

      <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Metal</Label>
          <select
            className="flex h-[var(--control-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.metal}
            onChange={(e) => setForm((f) => ({ ...f, metal: e.target.value }))}
          >
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="platinum">Platinum</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Purity</Label>
          <Input value={form.purity} onChange={(e) => setForm((f) => ({ ...f, purity: e.target.value }))} placeholder="22K" />
        </div>
        <div className="space-y-1.5">
          <Label>Rate per gram (INR)</Label>
          <Input value={form.rate_per_gram} onChange={(e) => setForm((f) => ({ ...f, rate_per_gram: e.target.value }))} placeholder="6000.00" />
        </div>
        <div className="space-y-1.5">
          <Label>Effective date</Label>
          <Input type="date" value={form.effective_date} onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))} />
        </div>
        <div className="sm:col-span-4">
          {saveRate.isError && <ErrorState error={saveRate.error} />}
          <Button onClick={() => saveRate.mutate()} disabled={!form.metal || !form.purity || !form.rate_per_gram || saveRate.isPending}>
            {saveRate.isPending ? "Saving..." : "Save rate"}
          </Button>
        </div>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {rates && rates.length === 0 && (
        <EmptyState icon={Coins} title="No rates entered yet" description="Save today's rate above to start pricing weight-based items." />
      )}

      {rates && rates.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Metal</th>
                <th className="px-4 py-2 font-medium">Purity</th>
                <th className="px-4 py-2 text-right font-medium">Rate / gram</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2">{r.effective_date}</td>
                  <td className="px-4 py-2 capitalize">{r.metal}</td>
                  <td className="px-4 py-2">{r.purity}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatINR(r.rate_per_gram)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
