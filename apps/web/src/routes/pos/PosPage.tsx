import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, Minus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrintReceiptOverlay } from "@/components/receipts/PrintReceiptOverlay";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface PosItem {
  id: string;
  sku: string;
  name: string;
  base_uom: string;
  standard_price: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface CartLine {
  item: PosItem;
  qty: number;
}

interface WalkInSaleReceipt {
  sale: { id: string; change_due: string };
  invoice_number: string;
  subtotal: string;
  tax_total: string;
  total: string;
}

type PaymentMode = "cash" | "upi" | "card";

/** Retail profile counter sale (ADR-010, Slice E): barcode/name search
 * builds a cart, checkout posts the whole cart to the server in one
 * call -- price and tax are resolved server-side (same price_line() the
 * quotation flow uses), never computed here, so the numbers shown before
 * checkout are clearly labelled as an estimate. */
export function PosPage() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [tendered, setTendered] = useState("");
  const [receipt, setReceipt] = useState<WalkInSaleReceipt | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => apiFetch<Warehouse[]>("/warehouses"),
  });
  const warehouseId = warehouses?.[0]?.id;

  const { data: results } = useQuery({
    queryKey: ["items", search],
    queryFn: () => apiFetch<PosItem[]>(`/items?q=${encodeURIComponent(search)}`),
    enabled: search.length > 0,
  });

  const estimatedTotal = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.item.standard_price) * line.qty, 0),
    [cart]
  );

  function addToCart(item: PosItem) {
    setCart((c) => {
      const existing = c.find((l) => l.item.id === item.id);
      if (existing) return c.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { item, qty: 1 }];
    });
    setSearch("");
  }

  function setQty(itemId: string, qty: number) {
    if (qty <= 0) {
      setCart((c) => c.filter((l) => l.item.id !== itemId));
      return;
    }
    setCart((c) => c.map((l) => (l.item.id === itemId ? { ...l, qty } : l)));
  }

  const checkout = useMutation({
    mutationFn: () => {
      const amounts = { cash_amount: "0", upi_amount: "0", card_amount: "0" };
      const key = `${mode}_amount` as keyof typeof amounts;
      amounts[key] = estimatedTotal.toFixed(2);
      return apiFetch<WalkInSaleReceipt>("/pos/sales", {
        method: "POST",
        body: {
          warehouse_id: warehouseId,
          items: cart.map((l) => ({ item_id: l.item.id, qty: l.qty, uom: l.item.base_uom })),
          ...amounts,
          tendered_amount: mode === "cash" ? tendered || amounts.cash_amount : amounts[key],
        },
      });
    },
    onSuccess: (data) => {
      setReceipt(data);
      setCart([]);
      setTendered("");
    },
  });

  if (receipt) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sale complete -- {receipt.invoice_number}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(receipt.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatINR(receipt.tax_total)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total</span><span>{formatINR(receipt.total)}</span></div>
            {Number(receipt.sale.change_due) > 0 && (
              <div className="flex justify-between text-emerald-600"><span>Change due</span><span>{formatINR(receipt.sale.change_due)}</span></div>
            )}
          </CardContent>
        </Card>
        <Button className="w-full" onClick={() => setShowPrint(true)}>Print receipt</Button>
        <Button className="w-full" variant="outline" onClick={() => setReceipt(null)}>New sale</Button>
        {showPrint && (
          <PrintReceiptOverlay documentType="pos_receipt" documentId={receipt.sale.id} onClose={() => setShowPrint(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">POS</h1>
          <p className="text-sm text-muted-foreground">Search by name or SKU (barcode scanners type-and-enter the same way).</p>
        </div>
        <Input
          autoFocus
          placeholder="Scan or search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {results && results.length > 0 && (
          <div className="divide-y overflow-hidden rounded-lg border border-border">
            {results.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-accent"
              >
                <span>
                  {item.name} <span className="text-muted-foreground">({item.sku})</span>
                </span>
                <span className="text-muted-foreground">{formatINR(item.standard_price)}</span>
              </button>
            ))}
          </div>
        )}

        {cart.length === 0 && <EmptyState icon={CreditCard} title="Cart is empty" description="Search for an item above to start a sale." />}

        {cart.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <tbody>
                {cart.map((line) => (
                  <tr key={line.item.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2">{line.item.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatINR(line.item.standard_price)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(line.item.id, line.qty - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center">{line.qty}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(line.item.id, line.qty + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{formatINR(Number(line.item.standard_price) * line.qty)}</td>
                    <td className="px-2 py-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setQty(line.item.id, 0)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Checkout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-lg font-semibold">
            <span>Estimated total</span>
            <span>{formatINR(estimatedTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Final price and tax are calculated at checkout.</p>

          <div className="space-y-1.5">
            <Label>Payment mode</Label>
            <div className="flex gap-2">
              {(["cash", "upi", "card"] as PaymentMode[]).map((m) => (
                <Button key={m} type="button" variant={mode === m ? "default" : "outline"} size="sm" onClick={() => setMode(m)} className="capitalize">
                  {m}
                </Button>
              ))}
            </div>
          </div>

          {mode === "cash" && (
            <div className="space-y-1.5">
              <Label>Tendered</Label>
              <Input type="number" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={estimatedTotal.toFixed(2)} />
            </div>
          )}

          {checkout.isError && <ErrorState error={checkout.error} />}

          <Button
            className="w-full"
            disabled={cart.length === 0 || !warehouseId || checkout.isPending}
            onClick={() => checkout.mutate()}
          >
            {checkout.isPending ? "Processing..." : `Charge ${formatINR(estimatedTotal)}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
