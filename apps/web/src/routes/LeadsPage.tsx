import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, MoreHorizontal, Plus, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface Lead {
  id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  estimated_value: string | null;
  notes: string | null;
  lost_reason: string | null;
  converted_customer_id: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified", proposal: "Proposal", won: "Won", lost: "Lost",
};
const STATUS_ORDER = ["new", "contacted", "qualified", "proposal", "won", "lost"];

function statusBadgeVariant(status: string): "success" | "secondary" | "outline" {
  if (status === "won") return "success";
  if (status === "qualified" || status === "proposal") return "secondary";
  return "outline";
}

type LeadForm = { name: string; company_name: string; phone: string; email: string; source: string; estimated_value: string; notes: string };
const BLANK_FORM: LeadForm = { name: "", company_name: "", phone: "", email: "", source: "", estimated_value: "", notes: "" };

export function LeadsPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(BLANK_FORM);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [convertForm, setConvertForm] = useState({ billing_state: "", credit_limit: "", credit_days: "" });

  const { data: leads, isLoading, error, refetch } = useQuery({
    queryKey: ["leads"], queryFn: () => apiFetch<Lead[]>("/leads"),
  });

  const createLead = useMutation({
    mutationFn: (values: LeadForm) =>
      apiFetch<Lead>("/leads", {
        method: "POST",
        body: {
          name: values.name,
          company_name: values.company_name || null,
          phone: values.phone || null,
          email: values.email || null,
          source: values.source || null,
          estimated_value: values.estimated_value || null,
          notes: values.notes || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setAddOpen(false);
      setAddForm(BLANK_FORM);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch<Lead>(`/leads/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const convert = useMutation({
    mutationFn: ({ id, values }: { id: string; values: typeof convertForm }) =>
      apiFetch<{ lead: Lead; customer: { id: string; name: string } }>(`/leads/${id}/convert`, {
        method: "POST",
        body: {
          billing_state: values.billing_state || null,
          credit_limit: values.credit_limit || null,
          credit_days: values.credit_days ? Number(values.credit_days) : null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setConvertLead(null);
      setConvertForm({ billing_state: "", credit_limit: "", credit_days: "" });
    },
  });

  const kpis = useMemo(() => {
    const rows = leads ?? [];
    return {
      total: rows.length,
      open: rows.filter((l) => !["won", "lost"].includes(l.status)).length,
      qualified: rows.filter((l) => l.status === "qualified" || l.status === "proposal").length,
      won: rows.filter((l) => l.status === "won").length,
    };
  }, [leads]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">The pipeline before a prospect becomes a real customer.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add lead
        </Button>
      </div>

      {leads && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Users} color="violet" label="Total leads" value={String(kpis.total)} />
          <KpiCard icon={Target} color="sky" label="Open" value={String(kpis.open)} />
          <KpiCard icon={TrendingUp} color="amber" label="Qualified / Proposal" value={String(kpis.qualified)} />
          <KpiCard icon={Trophy} color="emerald" label="Won" value={String(kpis.won)} />
        </div>
      )}

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {leads && leads.length === 0 && (
        <EmptyState icon={Target} title="No leads yet" description="Add your first lead to start the pipeline." actionLabel="Add lead" onAction={() => setAddOpen(true)} />
      )}

      {leads && leads.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Est. value</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr key={lead.id} className={`border-t border-border hover:bg-muted ${i % 2 === 1 ? "bg-muted/40" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{lead.company_name || lead.name}</div>
                      {lead.company_name && <div className="text-xs text-muted-foreground">{lead.name}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div>{lead.phone ?? <span className="text-muted-foreground">No phone on file</span>}</div>
                      <div className="text-xs text-muted-foreground">{lead.email ?? "No email on file"}</div>
                    </td>
                    <td className="px-4 py-3">{lead.source ?? <span className="text-muted-foreground">Not set</span>}</td>
                    <td className="px-4 py-3 font-medium">{lead.estimated_value ? formatINR(lead.estimated_value) : <span className="text-muted-foreground">--</span>}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant(lead.status)}>{STATUS_LABEL[lead.status] ?? lead.status}</Badge>
                      {lead.converted_customer_id && (
                        <Link to={`/customers/${lead.converted_customer_id}`} className="ml-2 text-xs text-primary hover:underline">
                          View customer
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {STATUS_ORDER.filter((s) => s !== lead.status && s !== "won").map((s) => (
                            <DropdownMenuItem key={s} onClick={() => updateStatus.mutate({ id: lead.id, status: s })}>
                              Mark as {STATUS_LABEL[s]}
                            </DropdownMenuItem>
                          ))}
                          {!lead.converted_customer_id && lead.status !== "lost" && (
                            <DropdownMenuItem onClick={() => setConvertLead(lead)}>
                              <ArrowRight className="h-4 w-4" /> Convert to customer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New lead</DialogTitle>
            <DialogDescription>Just enough to start the conversation -- more detail can come later.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Contact name</Label>
              <Input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ramesh Kumar" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Company</Label>
              <Input value={addForm.company_name} onChange={(e) => setAddForm((f) => ({ ...f, company_name: e.target.value }))} placeholder="Kumar Constructions" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Input value={addForm.source} onChange={(e) => setAddForm((f) => ({ ...f, source: e.target.value }))} placeholder="Referral" />
            </div>
            <div className="space-y-1.5">
              <Label>Estimated value</Label>
              <Input type="number" value={addForm.estimated_value} onChange={(e) => setAddForm((f) => ({ ...f, estimated_value: e.target.value }))} placeholder="500000" />
            </div>
          </div>
          {createLead.isError && <ErrorState error={createLead.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createLead.mutate(addForm)}
              disabled={!addForm.name || createLead.isPending}
            >
              {createLead.isPending ? "Saving..." : "Save lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertLead !== null} onOpenChange={(open) => !open && setConvertLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to customer</DialogTitle>
            <DialogDescription>
              Creates a real customer record from "{convertLead?.company_name || convertLead?.name}" -- billing state decides CGST+SGST vs IGST on invoices.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Billing state</Label>
              <Input value={convertForm.billing_state} onChange={(e) => setConvertForm((f) => ({ ...f, billing_state: e.target.value }))} placeholder="Andhra Pradesh" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Credit limit</Label>
                <Input type="number" value={convertForm.credit_limit} onChange={(e) => setConvertForm((f) => ({ ...f, credit_limit: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Credit days</Label>
                <Input type="number" value={convertForm.credit_days} onChange={(e) => setConvertForm((f) => ({ ...f, credit_days: e.target.value }))} placeholder="0" />
              </div>
            </div>
          </div>
          {convert.isError && <ErrorState error={convert.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertLead(null)}>Cancel</Button>
            <Button
              onClick={() => convertLead && convert.mutate({ id: convertLead.id, values: convertForm })}
              disabled={convert.isPending}
            >
              {convert.isPending ? "Converting..." : "Convert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
