import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Item { id: string; name: string; base_uom: string; }
interface CountItem { id: string; item_id: string; system_qty: string; counted_qty: string; variance: string; }
interface StockCount { id: string; status: string; count_date: string; items: CountItem[]; }

export function StockCountDetailPage() {
  const { countId } = useParams<{ countId: string }>();
  const queryClient = useQueryClient();
  const [counted, setCounted] = useState<Record<string, string>>({});

  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => apiFetch<Item[]>("/items") });
  const { data: count, isLoading, error, refetch } = useQuery({
    queryKey: ["stock-count", countId],
    queryFn: () => apiFetch<StockCount>(`/stock-counts/${countId}`),
  });

  const submit = useMutation({
    mutationFn: () =>
      apiFetch(`/stock-counts/${countId}/submit`, {
        method: "POST",
        body: { counted_quantities: counted },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-count", countId] }),
  });

  const approve = useMutation({
    mutationFn: () => apiFetch(`/stock-counts/${countId}/approve`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-count", countId] }),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!count) return null;

  const itemName = (id: string) => items?.find((i) => i.id === id)?.name ?? id;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stock count -- {count.count_date}</h1>
          <Badge variant={count.status === "approved" ? "success" : "secondary"} className="mt-1">{count.status}</Badge>
        </div>
        {count.status === "draft" && (
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>{submit.isPending ? "Submitting..." : "Submit count"}</Button>
        )}
        {count.status === "submitted" && (
          <Button onClick={() => approve.mutate()} disabled={approve.isPending}>{approve.isPending ? "Approving..." : "Approve & post adjustment"}</Button>
        )}
      </div>

      {(submit.isError || approve.isError) && <ErrorState error={submit.error ?? approve.error} />}

      <Card>
        <CardHeader><CardTitle className="text-base">Lines</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="pb-2">Item</th>
                <th className="pb-2">Book qty</th>
                <th className="pb-2">Counted qty</th>
                {count.status !== "draft" && <th className="pb-2">Variance</th>}
              </tr>
            </thead>
            <tbody>
              {count.items.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="py-2">{itemName(line.item_id)}</td>
                  <td className="py-2 text-muted-foreground">{line.system_qty}</td>
                  <td className="py-2">
                    {count.status === "draft" ? (
                      <Input
                        type="number"
                        className="h-8 w-24"
                        defaultValue={line.counted_qty}
                        onChange={(e) => setCounted((prev) => ({ ...prev, [line.item_id]: e.target.value }))}
                      />
                    ) : (
                      line.counted_qty
                    )}
                  </td>
                  {count.status !== "draft" && (
                    <td className={cn("py-2 font-medium", Number(line.variance) !== 0 ? "text-amber-600" : "text-muted-foreground")}>
                      {Number(line.variance) > 0 ? "+" : ""}{line.variance}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
