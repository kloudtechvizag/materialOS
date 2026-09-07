import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface OrderCard {
  id: string;
  number: string;
  total: string;
}

interface ChallanCard {
  id: string;
  number: string;
  sales_order_id: string;
}

interface Board {
  pending_orders: OrderCard[];
  ready_to_dispatch: OrderCard[];
  dispatched: ChallanCard[];
  delivered: ChallanCard[];
}

function Column({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function OrderChip({ order, linkTo }: { order: OrderCard; linkTo: string }) {
  return (
    <Link to={linkTo}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="p-3">
          <p className="text-sm font-medium text-primary">{order.number}</p>
          <p className="text-xs text-muted-foreground">{formatINR(order.total)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function ChallanChip({ challan }: { challan: ChallanCard }) {
  return (
    <Link to={`/sales-orders/${challan.sales_order_id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="p-3">
          <p className="text-sm font-medium text-primary">{challan.number}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DispatchBoardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dispatch-board"],
    queryFn: () => apiFetch<Board>("/dispatch-board"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dispatch board</h1>
        <p className="text-sm text-muted-foreground">Every order, from quoted to delivered, in one view.</p>
      </div>

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && (
        <div className="flex gap-6 overflow-x-auto pb-4">
          <Column title="Pending (not yet ordered)" count={data.pending_orders.length}>
            {data.pending_orders.map((o) => <OrderChip key={o.id} order={o} linkTo={`/sales-orders/${o.id}`} />)}
          </Column>
          <Column title="Ready to dispatch" count={data.ready_to_dispatch.length}>
            {data.ready_to_dispatch.map((o) => <OrderChip key={o.id} order={o} linkTo={`/sales-orders/${o.id}`} />)}
          </Column>
          <Column title="Dispatched / in transit" count={data.dispatched.length}>
            {data.dispatched.map((c) => <ChallanChip key={c.id} challan={c} />)}
          </Column>
          <Column title="Delivered" count={data.delivered.length}>
            {data.delivered.map((c) => <ChallanChip key={c.id} challan={c} />)}
          </Column>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Fleet &amp; trips</CardTitle></CardHeader>
        <CardContent className="flex gap-4 text-sm">
          <Link to="/fleet" className="text-primary hover:underline">Vehicles &amp; drivers</Link>
          <Link to="/trips" className="text-primary hover:underline">Trips</Link>
          <Link to="/stock-counts" className="text-primary hover:underline">Stock counts</Link>
          <Link to="/transfers" className="text-primary hover:underline">Warehouse transfers</Link>
        </CardContent>
      </Card>
    </div>
  );
}
