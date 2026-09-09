import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, ShieldCheck, Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";

interface SerialUnit {
  id: string;
  item_id: string;
  serial_number: string;
  status: string;
  warranty_expiry: string | null;
  notes: string | null;
}

interface RmaRequest {
  id: string;
  number: string;
  serial_unit_id: string;
  customer_id: string;
  reason: string;
  status: string;
  resolution: string | null;
  requested_date: string;
}

interface Item { id: string; name: string; sku: string }
interface Customer { id: string; name: string }

const RMA_NEXT: Record<string, { status: string; label: string; resolution?: string }[]> = {
  requested: [{ status: "approved", label: "Approve" }, { status: "rejected", label: "Reject" }],
  approved: [{ status: "in_repair", label: "Start repair" }, { status: "rejected", label: "Reject" }],
  in_repair: [
    { status: "resolved", label: "Mark repaired", resolution: "repaired" },
    { status: "resolved", label: "Mark replaced", resolution: "replaced" },
    { status: "rejected", label: "Reject" },
  ],
};

function statusBadgeClass(status: string) {
  if (status === "resolved") return "border-[#A7F3D0] text-[#047857]";
  if (status === "rejected") return "text-muted-foreground";
  return "border-[#DDD6FE] text-[#6D28D9]";
}

export function SerialRmaPage() {
  const queryClient = useQueryClient();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({ sku: "", serial_number: "", warranty_expiry: "" });
  const [rmaOpen, setRmaOpen] = useState(false);
  const [rmaForm, setRmaForm] = useState({ serial_number: "", customer_name: "", reason: "" });

  const { data: serials, isLoading: loadingSerials, error: serialsError } = useQuery({
    queryKey: ["serial-units"], queryFn: () => apiFetch<SerialUnit[]>("/serial-units"),
  });
  const { data: rmas, isLoading: loadingRmas, error: rmasError } = useQuery({
    queryKey: ["rma-requests"], queryFn: () => apiFetch<RmaRequest[]>("/rma-requests"),
  });
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => apiFetch<Item[]>("/items") });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => apiFetch<Customer[]>("/customers") });

  const itemBySku = new Map((items ?? []).map((i) => [i.sku.toLowerCase(), i]));
  const itemById = new Map((items ?? []).map((i) => [i.id, i]));
  const customerByName = new Map((customers ?? []).map((c) => [c.name.toLowerCase(), c]));

  const registerSerial = useMutation({
    mutationFn: async (values: typeof registerForm) => {
      const item = itemBySku.get(values.sku.toLowerCase());
      if (!item) throw new ApiError(0, { error: { code: "VALIDATION_ERROR", message: `No item with SKU "${values.sku}".`, details: {}, retryable: false } });
      return apiFetch<SerialUnit>("/serial-units", {
        method: "POST",
        body: { item_id: item.id, serial_number: values.serial_number, warranty_expiry: values.warranty_expiry || null },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serial-units"] });
      setRegisterOpen(false);
      setRegisterForm({ sku: "", serial_number: "", warranty_expiry: "" });
    },
  });

  const createRma = useMutation({
    mutationFn: async (values: typeof rmaForm) => {
      const unit = (serials ?? []).find((s) => s.serial_number.toLowerCase() === values.serial_number.toLowerCase());
      if (!unit) throw new ApiError(0, { error: { code: "VALIDATION_ERROR", message: `No registered serial "${values.serial_number}".`, details: {}, retryable: false } });
      const customer = customerByName.get(values.customer_name.toLowerCase());
      if (!customer) throw new ApiError(0, { error: { code: "VALIDATION_ERROR", message: `No customer named "${values.customer_name}".`, details: {}, retryable: false } });
      return apiFetch<RmaRequest>("/rma-requests", {
        method: "POST", body: { serial_unit_id: unit.id, customer_id: customer.id, reason: values.reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rma-requests"] });
      queryClient.invalidateQueries({ queryKey: ["serial-units"] });
      setRmaOpen(false);
      setRmaForm({ serial_number: "", customer_name: "", reason: "" });
    },
  });

  const transitionRma = useMutation({
    mutationFn: ({ id, status, resolution }: { id: string; status: string; resolution?: string }) =>
      apiFetch<RmaRequest>(`/rma-requests/${id}`, { method: "PATCH", body: { status, resolution } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rma-requests"] });
      queryClient.invalidateQueries({ queryKey: ["serial-units"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Serial numbers &amp; RMA</h1>
          <p className="text-sm text-muted-foreground">Individually-tracked units and their warranty/repair history.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRmaOpen(true)}><ShieldCheck className="h-4 w-4" /> New RMA</Button>
          <Button className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" onClick={() => setRegisterOpen(true)}>
            <Plus className="h-4 w-4" /> Register serial
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Smartphone className="h-4 w-4" /> Serial units</h2>
        {loadingSerials && <Skeleton className="h-32" />}
        {serialsError && <ErrorState error={serialsError} />}
        {serials && serials.length === 0 && (
          <EmptyState icon={Smartphone} title="No serial units registered" description="Register a serial/IMEI to start tracking it individually." actionLabel="Register serial" onAction={() => setRegisterOpen(true)} />
        )}
        {serials && serials.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Serial / IMEI</th>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium">Warranty</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {serials.map((s) => (
                  <tr key={s.id} className="border-t border-[#E2E8F0]">
                    <td className="px-4 py-2 font-mono">{s.serial_number}</td>
                    <td className="px-4 py-2">{itemById.get(s.item_id)?.name ?? s.item_id}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.warranty_expiry ?? "--"}</td>
                    <td className="px-4 py-2"><Badge variant="outline">{s.status.replace("_", " ")}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><ShieldCheck className="h-4 w-4" /> RMA requests</h2>
        {loadingRmas && <Skeleton className="h-32" />}
        {rmasError && <ErrorState error={rmasError} />}
        {rmas && rmas.length === 0 && (
          <EmptyState icon={ShieldCheck} title="No RMA requests" description="Log one against a registered serial when a customer reports an issue." />
        )}
        {rmas && rmas.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">RMA</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rmas.map((r) => (
                  <tr key={r.id} className="border-t border-[#E2E8F0]">
                    <td className="px-4 py-2 font-medium">{r.number}</td>
                    <td className="px-4 py-2">{r.reason}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={statusBadgeClass(r.status)}>{r.status.replace("_", " ")}</Badge>
                      {r.resolution && <span className="ml-2 text-xs text-muted-foreground">({r.resolution})</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {RMA_NEXT[r.status] && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {RMA_NEXT[r.status].map((action) => (
                              <DropdownMenuItem
                                key={action.label}
                                onClick={() => transitionRma.mutate({ id: r.id, status: action.status, resolution: action.resolution })}
                              >
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register serial / IMEI</DialogTitle>
            <DialogDescription>Individually track one unit of an item.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Item SKU</Label><Input value={registerForm.sku} onChange={(e) => setRegisterForm((f) => ({ ...f, sku: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Serial / IMEI</Label><Input value={registerForm.serial_number} onChange={(e) => setRegisterForm((f) => ({ ...f, serial_number: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Warranty expiry</Label><Input type="date" value={registerForm.warranty_expiry} onChange={(e) => setRegisterForm((f) => ({ ...f, warranty_expiry: e.target.value }))} /></div>
          </div>
          {registerSerial.isError && <ErrorState error={registerSerial.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
            <Button className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" onClick={() => registerSerial.mutate(registerForm)} disabled={!registerForm.sku || !registerForm.serial_number || registerSerial.isPending}>
              {registerSerial.isPending ? "Saving..." : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rmaOpen} onOpenChange={setRmaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New RMA request</DialogTitle>
            <DialogDescription>Logs an issue against an already-registered serial number.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Serial / IMEI</Label><Input value={rmaForm.serial_number} onChange={(e) => setRmaForm((f) => ({ ...f, serial_number: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Customer</Label><Input value={rmaForm.customer_name} onChange={(e) => setRmaForm((f) => ({ ...f, customer_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Reason</Label><Input value={rmaForm.reason} onChange={(e) => setRmaForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Screen not turning on" /></div>
          </div>
          {createRma.isError && <ErrorState error={createRma.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRmaOpen(false)}>Cancel</Button>
            <Button className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" onClick={() => createRma.mutate(rmaForm)} disabled={!rmaForm.serial_number || !rmaForm.customer_name || !rmaForm.reason || createRma.isPending}>
              {createRma.isPending ? "Saving..." : "Create RMA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
