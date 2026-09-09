import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Building2,
  Download,
  Factory,
  FileWarning,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { useIndustryProfile } from "@/lib/industryProfile";

interface Supplier {
  id: string;
  name: string;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  billing_state: string | null;
  category: string | null;
  is_active: boolean;
  outstanding_balance: string | null;
  open_purchase_orders: number | null;
}

interface SuppliersSummary {
  total_suppliers: number;
  active_purchase_orders: number;
  total_outstanding: string;
  missing_gstin_count: number;
}

type SupplierFormValues = { name: string; gstin: string; phone: string; email: string; billing_state: string; category: string };
const BLANK_FORM: SupplierFormValues = { name: "", gstin: "", phone: "", email: "", billing_state: "", category: "" };

type SupplierPatchBody = {
  name?: string;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  billing_state?: string | null;
  category?: string | null;
  is_active?: boolean;
};

type SortKey = "name" | "outstanding_balance" | "billing_state";
const PAGE_SIZE = 10;

function KpiCard({ icon: Icon, iconColor, iconBg, label, value }: { icon: typeof Building2; iconColor: string; iconBg: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: iconBg }}>
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function FieldSet({ form, setForm, nameExample }: { form: SupplierFormValues; setForm: React.Dispatch<React.SetStateAction<SupplierFormValues>>; nameExample: string }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 space-y-1.5">
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={nameExample} />
      </div>
      <div className="space-y-1.5">
        <Label>GSTIN</Label>
        <Input value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} placeholder="22AAAAA0000A1Z5" />
      </div>
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Raw Materials" />
      </div>
      <div className="space-y-1.5">
        <Label>Phone</Label>
        <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label>Billing state</Label>
        <Input value={form.billing_state} onChange={(e) => setForm((f) => ({ ...f, billing_state: e.target.value }))} placeholder="Andhra Pradesh" />
      </div>
    </div>
  );
}

function downloadCsv(rows: Supplier[]) {
  const header = ["Name", "Category", "Phone", "Email", "State", "GSTIN", "Outstanding balance", "Status"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((s) =>
    [s.name, s.category ?? "", s.phone ?? "", s.email ?? "", s.billing_state ?? "", s.gstin ?? "", s.outstanding_balance ?? "0", s.is_active ? "Active" : "Inactive"]
      .map((v) => escape(String(v)))
      .join(",")
  );
  const csv = [header.map(escape).join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `suppliers-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function SuppliersPage() {
  const queryClient = useQueryClient();
  const { profile } = useIndustryProfile();
  const nameExample = profile?.terminology?.supplier_name_example ?? "Supplier name";

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(BLANK_FORM);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [editForm, setEditForm] = useState(BLANK_FORM);

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const { data: suppliers, isLoading, error, refetch } = useQuery({
    queryKey: ["suppliers"], queryFn: () => apiFetch<Supplier[]>("/suppliers?include_inactive=true"),
  });
  const { data: summary } = useQuery({
    queryKey: ["suppliers-summary"], queryFn: () => apiFetch<SuppliersSummary>("/suppliers/summary"),
  });

  const createSupplier = useMutation({
    mutationFn: (values: SupplierFormValues) => apiFetch<Supplier>("/suppliers", { method: "POST", body: cleanForm(values) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-summary"] });
      setAddOpen(false);
      setAddForm(BLANK_FORM);
    },
  });

  const updateSupplier = useMutation({
    mutationFn: ({ id, values }: { id: string; values: SupplierPatchBody }) =>
      apiFetch<Supplier>(`/suppliers/${id}`, { method: "PATCH", body: values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-summary"] });
      setEditSupplier(null);
    },
  });

  const states = useMemo(
    () => Array.from(new Set((suppliers ?? []).map((s) => s.billing_state).filter((v): v is string => Boolean(v)))).sort(),
    [suppliers]
  );
  const categories = useMemo(
    () => Array.from(new Set((suppliers ?? []).map((s) => s.category).filter((v): v is string => Boolean(v)))).sort(),
    [suppliers]
  );

  const filtered = useMemo(() => {
    let rows = suppliers ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (s) => s.name.toLowerCase().includes(q) || (s.gstin ?? "").toLowerCase().includes(q) || (s.phone ?? "").includes(q)
      );
    }
    if (stateFilter) rows = rows.filter((s) => s.billing_state === stateFilter);
    if (categoryFilter) rows = rows.filter((s) => s.category === categoryFilter);
    if (statusFilter) rows = rows.filter((s) => (statusFilter === "active" ? s.is_active : !s.is_active));

    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sort.key === "name") cmp = a.name.localeCompare(b.name);
      else if (sort.key === "billing_state") cmp = (a.billing_state ?? "").localeCompare(b.billing_state ?? "");
      else cmp = Number(a.outstanding_balance ?? 0) - Number(b.outstanding_balance ?? 0);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [suppliers, search, stateFilter, categoryFilter, statusFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function toggleSelected(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openEdit(s: Supplier) {
    setEditSupplier(s);
    setEditForm({ name: s.name, gstin: s.gstin ?? "", phone: s.phone ?? "", email: s.email ?? "", billing_state: s.billing_state ?? "", category: s.category ?? "" });
  }

  function cleanForm(values: SupplierFormValues): SupplierPatchBody {
    return {
      name: values.name,
      gstin: values.gstin || null,
      phone: values.phone || null,
      email: values.email || null,
      billing_state: values.billing_state || null,
      category: values.category || null,
    };
  }

  const exportSelected = () => {
    const rows = selected.size > 0 ? filtered.filter((s) => selected.has(s.id)) : filtered;
    downloadCsv(rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Billing state drives CGST+SGST vs IGST on purchase bills.</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Building2} iconColor="#7C3AED" iconBg="#EDE9FE" label="Total suppliers" value={String(summary.total_suppliers)} />
          <KpiCard icon={ShoppingCart} iconColor="#10B981" iconBg="#D1FAE5" label="Active purchase orders" value={String(summary.active_purchase_orders)} />
          <KpiCard icon={Wallet} iconColor="#7C3AED" iconBg="#EDE9FE" label="Total outstanding balance" value={formatINR(summary.total_outstanding)} />
          <KpiCard icon={FileWarning} iconColor="#FF6B00" iconBg="#FFEDD5" label="Missing GSTIN" value={String(summary.missing_gstin_count)} />
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, GSTIN, or phone"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={stateFilter}
            onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
          >
            <option value="">All states</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportSelected} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Export{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          <Button size="sm" className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add supplier
          </Button>
        </div>
      </div>

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {suppliers && suppliers.length === 0 && (
        <EmptyState icon={Factory} title="No suppliers yet" description="Add your first supplier, or import them from Tally/Busy." actionLabel="Add supplier" onAction={() => setAddOpen(true)} />
      )}

      {suppliers && suppliers.length > 0 && filtered.length === 0 && (
        <EmptyState icon={Search} title="No suppliers match your filters" description="Try a different search term or clear a filter." />
      )}

      {pageRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={pageRows.every((s) => selected.has(s.id)) && pageRows.length > 0}
                      onCheckedChange={(checked: boolean | "indeterminate") =>
                        setSelected((s) => {
                          const next = new Set(s);
                          pageRows.forEach((row) => (checked === true ? next.add(row.id) : next.delete(row.id)));
                          return next;
                        })
                      }
                    />
                  </th>
                  <SortableHeader label="Supplier" active={sort.key === "name"} dir={sort.dir} onClick={() => toggleSort("name")} />
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <SortableHeader label="Location" active={sort.key === "billing_state"} dir={sort.dir} onClick={() => toggleSort("billing_state")} />
                  <th className="px-4 py-3 font-medium">GSTIN</th>
                  <SortableHeader label="Outstanding" active={sort.key === "outstanding_balance"} dir={sort.dir} onClick={() => toggleSort("outstanding_balance")} />
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s, i) => (
                  <tr key={s.id} className={`border-t border-[#E2E8F0] hover:bg-[#F8FAFC] ${i % 2 === 1 ? "bg-[#FAFBFC]" : ""}`}>
                    <td className="px-4 py-3"><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggleSelected(s.id)} /></td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.name}</div>
                      {s.category ? (
                        <Badge variant="outline" className="mt-1 border-[#DDD6FE] text-[#6D28D9]">{s.category}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Uncategorized</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>{s.phone ?? <span className="text-muted-foreground">No phone on file</span>}</div>
                      <div className="text-xs text-muted-foreground">{s.email ?? "No email on file"}</div>
                    </td>
                    <td className="px-4 py-3">
                      {s.billing_state ?? <Badge variant="outline" className="text-muted-foreground">State not set</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      {s.gstin ?? <Badge variant="outline" className="border-[#FED7AA] text-[#C2410C]">GSTIN missing</Badge>}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatINR(s.outstanding_balance ?? 0)}</td>
                    <td className="px-4 py-3">
                      {s.is_active ? (
                        <Badge variant="outline" className="border-[#A7F3D0] text-[#047857]">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/suppliers/${s.id}`}><Receipt className="h-4 w-4" /> View 360</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(s)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateSupplier.mutate({ id: s.id, values: { is_active: !s.is_active } })}>
                            {s.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-muted-foreground">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span>Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New supplier</DialogTitle>
            <DialogDescription>Billing state decides CGST+SGST vs IGST on every purchase bill.</DialogDescription>
          </DialogHeader>
          <FieldSet form={addForm} setForm={setAddForm} nameExample={nameExample} />
          {createSupplier.isError && <ErrorState error={createSupplier.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
              onClick={() => createSupplier.mutate(addForm)}
              disabled={!addForm.name || createSupplier.isPending}
            >
              {createSupplier.isPending ? "Saving..." : "Save supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editSupplier !== null} onOpenChange={(open) => !open && setEditSupplier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit supplier</DialogTitle>
          </DialogHeader>
          <FieldSet form={editForm} setForm={setEditForm} nameExample={nameExample} />
          {updateSupplier.isError && <ErrorState error={updateSupplier.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSupplier(null)}>Cancel</Button>
            <Button
              className="bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
              onClick={() => editSupplier && updateSupplier.mutate({ id: editSupplier.id, values: cleanForm(editForm) })}
              disabled={!editForm.name || updateSupplier.isPending}
            >
              {updateSupplier.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <th className="px-4 py-3 font-medium">
      <button type="button" onClick={onClick} className="flex items-center gap-1 hover:text-foreground">
        {label}
        <ArrowUpDown className={`h-3.5 w-3.5 ${active ? "text-foreground" : "text-muted-foreground/50"}`} />
        {active && <span className="sr-only">{dir === "asc" ? "ascending" : "descending"}</span>}
      </button>
    </th>
  );
}
