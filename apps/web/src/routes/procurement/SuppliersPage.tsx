import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Building2,
  Download,
  Factory,
  FileWarning,
  Plus,
  RefreshCw,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionableHeader,
  AttentionPanel,
  BulkActionBar,
  DetailDrawer,
  MetricStrip,
  RowActions,
  SavedViews,
  SmartEmptyState,
  StatusBadge,
  type AttentionItem,
  type MetricItem,
} from "@/components/workspace";
import { apiFetch } from "@/lib/api";
import { formatINR, formatINRCompact } from "@/lib/format";
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
const PAGE_SIZE = 15;

function FieldSet({ form, setForm, nameExample }: { form: SupplierFormValues; setForm: React.Dispatch<React.SetStateAction<SupplierFormValues>>; nameExample: string }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 space-y-1.5">
        <Label>Name *</Label>
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
        <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="vendor@example.com" />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label>Billing State *</Label>
        <Input value={form.billing_state} onChange={(e) => setForm((f) => ({ ...f, billing_state: e.target.value }))} placeholder="e.g. Andhra Pradesh, Maharashtra" />
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
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const {
    data: suppliers,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiFetch<Supplier[]>("/suppliers?include_inactive=true"),
  });

  const { data: summary } = useQuery({
    queryKey: ["suppliers-summary"],
    queryFn: () => apiFetch<SuppliersSummary>("/suppliers/summary"),
  });

  const createSupplier = useMutation({
    mutationFn: (values: SupplierFormValues) =>
      apiFetch<Supplier>("/suppliers", { method: "POST", body: cleanForm(values) }),
    onSuccess: (newSupp) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-summary"] });
      toast.success(`Supplier ${newSupp.name} added successfully.`);
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
      toast.success("Supplier updated successfully.");
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

  // Filter logic
  const filtered = useMemo(() => {
    let rows = suppliers ?? [];

    if (activeTab === "active") rows = rows.filter((s) => s.is_active);
    else if (activeTab === "inactive") rows = rows.filter((s) => !s.is_active);
    else if (activeTab === "missing_gstin") rows = rows.filter((s) => !s.gstin);
    else if (activeTab === "open_pos") rows = rows.filter((s) => (s.open_purchase_orders ?? 0) > 0);

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (s) => s.name.toLowerCase().includes(q) || (s.gstin ?? "").toLowerCase().includes(q) || (s.phone ?? "").includes(q)
      );
    }
    if (stateFilter) rows = rows.filter((s) => s.billing_state === stateFilter);
    if (categoryFilter) rows = rows.filter((s) => s.category === categoryFilter);

    rows = [...rows].sort((a, b) => {
      let va = a[sort.key] ?? "";
      let vb = b[sort.key] ?? "";
      if (sort.key === "outstanding_balance") {
        const na = Number(a.outstanding_balance ?? 0);
        const nb = Number(b.outstanding_balance ?? 0);
        return sort.dir === "asc" ? na - nb : nb - na;
      }
      return sort.dir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

    return rows;
  }, [suppliers, activeTab, search, stateFilter, categoryFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function openEdit(s: Supplier) {
    setEditSupplier(s);
    setEditForm({
      name: s.name,
      gstin: s.gstin ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      billing_state: s.billing_state ?? "",
      category: s.category ?? "",
    });
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

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!summary) return [];
    return [
      {
        id: "total",
        label: "Total Suppliers",
        value: summary.total_suppliers,
        subvalue: "Active vendor registry",
        icon: Building2,
        color: "slate",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "orders",
        label: "Open Purchase Orders",
        value: summary.active_purchase_orders,
        subvalue: "Active procurement lines",
        icon: ShoppingCart,
        color: "emerald",
        onClick: () => setActiveTab("open_pos"),
      },
      {
        id: "outstanding",
        label: "Outstanding Payables",
        value: formatINRCompact(summary.total_outstanding),
        subvalue: "Pending vendor bills",
        icon: Wallet,
        color: Number(summary.total_outstanding) > 0 ? "amber" : "slate",
      },
      {
        id: "missing_gstin",
        label: "Missing GSTIN",
        value: summary.missing_gstin_count,
        subvalue: summary.missing_gstin_count > 0 ? "ITC credit at risk" : "100% compliant",
        icon: FileWarning,
        color: summary.missing_gstin_count > 0 ? "rose" : "slate",
        onClick: () => setActiveTab("missing_gstin"),
      },
    ];
  }, [summary]);

  // Attention items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!summary || !suppliers) return [];
    const itemsList: AttentionItem[] = [];

    if (summary.missing_gstin_count > 0) {
      itemsList.push({
        id: "missing-gstin",
        title: `${summary.missing_gstin_count} Vendor${summary.missing_gstin_count > 1 ? "s" : ""} Missing GSTIN`,
        count: summary.missing_gstin_count,
        description: "Missing tax identification prevents Input Tax Credit (ITC) reconciliation under GST.",
        severity: "critical",
        actionLabel: "Filter Missing GSTIN",
        onAction: () => setActiveTab("missing_gstin"),
      });
    }

    const inactiveWithBalance = suppliers.filter((s) => !s.is_active && Number(s.outstanding_balance || 0) > 0);
    if (inactiveWithBalance.length > 0) {
      itemsList.push({
        id: "inactive-balance",
        title: `${inactiveWithBalance.length} Inactive Vendor${inactiveWithBalance.length > 1 ? "s" : ""} With Unsettled Balances`,
        count: inactiveWithBalance.length,
        description: "Deactivated supplier records still possess recorded payable dues.",
        severity: "warning",
        actionLabel: "Review Inactive",
        onAction: () => setActiveTab("inactive"),
      });
    }

    return itemsList;
  }, [summary, suppliers]);

  // Saved view tabs
  const viewTabs = useMemo(() => {
    if (!suppliers) return [];
    const activeCount = suppliers.filter((s) => s.is_active).length;
    const inactiveCount = suppliers.filter((s) => !s.is_active).length;
    const missingGstinCount = suppliers.filter((s) => !s.gstin).length;
    const openPosCount = suppliers.filter((s) => (s.open_purchase_orders ?? 0) > 0).length;

    return [
      { id: "all", label: "All Vendors", count: suppliers.length },
      { id: "active", label: "Active", count: activeCount },
      { id: "open_pos", label: "With Open Orders", count: openPosCount },
      { id: "missing_gstin", label: "Missing GSTIN", count: missingGstinCount },
      { id: "inactive", label: "Inactive", count: inactiveCount },
    ];
  }, [suppliers]);

  // Bulk actions
  const allSelected = pageRows.length > 0 && pageRows.every((r) => selectedIds.includes(r.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pageRows.map((r) => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const exportSelected = () => {
    const rows = selectedIds.length > 0 ? filtered.filter((s) => selectedIds.includes(s.id)) : filtered;
    downloadCsv(rows);
    toast.success(`Exported ${rows.length} suppliers to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Suppliers &amp; Vendors"
        subtitle="Vendor directory & tax compliance: billing state drives CGST+SGST vs IGST on purchase bills."
        badge={suppliers ? `${suppliers.length} vendors` : undefined}
        primaryAction={{
          label: "Add Supplier",
          icon: Plus,
          onClick: () => setAddOpen(true),
        }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: exportSelected,
          },
          {
            label: "Refresh",
            icon: RefreshCw,
            onClick: () => refetch(),
            disabled: isRefetching,
          },
        ]}
      />

      {/* 2. Metrics */}
      <MetricStrip metrics={metrics} />

      {/* 3. Attention Panel */}
      <AttentionPanel
        title="Vendor Compliance &amp; Payables Exceptions"
        items={attentionItems}
        allClearMessage="Vendor registry compliant. All active suppliers have verified GSTIN records."
      />

      {/* 4. Saved Views & Search */}
      <SavedViews
        tabs={viewTabs}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setPage(1);
        }}
        searchQuery={search}
        onSearchChange={(q) => {
          setSearch(q);
          setPage(1);
        }}
        searchPlaceholder="Search vendor name, GSTIN, phone..."
      >
        <div className="flex items-center gap-2">
          {states.length > 0 && (
            <select
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {categories.length > 0 && (
            <select
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </SavedViews>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* Empty states */}
      {suppliers && suppliers.length === 0 && (
        <SmartEmptyState
          type="first-time"
          icon={Factory}
          title="No suppliers configured yet"
          description="Add your first supplier or vendor to issue purchase orders and track goods receipts."
          primaryAction={{
            label: "Add First Supplier",
            icon: Plus,
            onClick: () => setAddOpen(true),
          }}
        />
      )}

      {suppliers && suppliers.length > 0 && filtered.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No suppliers match your filters"
          description={`No vendors found matching "${search}" in ${activeTab} view.`}
          primaryAction={{
            label: "Reset Filter",
            onClick: () => {
              setActiveTab("all");
              setSearch("");
              setStateFilter("");
              setCategoryFilter("");
            },
          }}
        />
      )}

      {/* 5. Action-First Data Grid */}
      {pageRows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                </th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort("name")}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Supplier / Vendor</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Contact</th>
                <th
                  className="hidden px-4 py-3 font-medium xl:table-cell cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort("billing_state")}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Location</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">GSTIN</th>
                <th
                  className="px-4 py-3 font-medium text-right cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort("outstanding_balance")}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Outstanding Payables</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="w-24 px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((s) => (
                <tr
                  key={s.id}
                  className="group transition-colors hover:bg-accent/40 cursor-pointer"
                  onClick={() => setDetailSupplier(s)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(s.id)}
                      onCheckedChange={() => toggleSelectOne(s.id)}
                      aria-label={`Select ${s.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{s.name}</div>
                    {s.category ? (
                      <Badge variant="secondary" className="mt-0.5 text-xs">
                        {s.category}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">General Vendor</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    <div>{s.phone || "—"}</div>
                    {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">
                    {s.billing_state || "—"}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs lg:table-cell">
                    {s.gstin ? (
                      <span>{s.gstin}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                        <FileWarning className="h-3 w-3" /> Missing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatINR(s.outstanding_balance ?? "0")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.is_active ? "active" : "inactive"} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowActions
                      onView={() => setDetailSupplier(s)}
                      onEdit={() => openEdit(s)}
                      onCopy={() => {
                        navigator.clipboard.writeText(s.name);
                        toast.success(`Copied ${s.name}`);
                      }}
                      viewLabel="Inspect Vendor"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} suppliers
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            id: "export",
            label: "Export Selected",
            icon: Download,
            onClick: exportSelected,
          },
        ]}
      />

      {/* 7. Contextual 360 Detail Drawer */}
      <DetailDrawer
        open={Boolean(detailSupplier)}
        onOpenChange={(open) => !open && setDetailSupplier(null)}
        title={detailSupplier?.name ?? ""}
        subtitle={detailSupplier?.category ?? "General Vendor"}
        badge={detailSupplier ? <StatusBadge status={detailSupplier.is_active ? "active" : "inactive"} /> : undefined}
        metrics={
          detailSupplier
            ? [
                { label: "Payables Due", value: formatINR(detailSupplier.outstanding_balance ?? "0") },
                {
                  label: "Open Purchase Orders",
                  value: String(detailSupplier.open_purchase_orders ?? 0),
                },
              ]
            : []
        }
        sections={
          detailSupplier
            ? [
                {
                  title: "Tax & Compliance Profile",
                  content: (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-border/40 py-1">
                        <span className="text-muted-foreground">GSTIN:</span>
                        <span className="font-mono font-medium">
                          {detailSupplier.gstin || (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">Missing (ITC at risk)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 py-1">
                        <span className="text-muted-foreground">Billing State:</span>
                        <span className="font-medium">{detailSupplier.billing_state || "Not configured"}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Contact Information",
                  content: (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-border/40 py-1">
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="font-medium">{detailSupplier.phone || "—"}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 py-1">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{detailSupplier.email || "—"}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Vendor Actions",
                  content: (
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const s = detailSupplier;
                          setDetailSupplier(null);
                          openEdit(s);
                        }}
                      >
                        Edit Vendor Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          updateSupplier.mutate({
                            id: detailSupplier.id,
                            values: { is_active: !detailSupplier.is_active },
                          });
                          setDetailSupplier((prev) => (prev ? { ...prev, is_active: !prev.is_active } : null));
                        }}
                      >
                        {detailSupplier.is_active ? "Deactivate Supplier" : "Reactivate Supplier"}
                      </Button>
                    </div>
                  ),
                },
              ]
            : []
        }
      />

      {/* 8. Add Supplier Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Supplier / Vendor</DialogTitle>
            <DialogDescription>
              Create a vendor record with GSTIN and billing state for accurate CGST+SGST or IGST tax calculations.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <FieldSet form={addForm} setForm={setAddForm} nameExample={nameExample} />
          </div>
          {createSupplier.isError && <ErrorState error={createSupplier.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createSupplier.mutate(addForm)} disabled={!addForm.name.trim() || createSupplier.isPending}>
              {createSupplier.isPending ? "Saving..." : "Add Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 9. Edit Supplier Dialog */}
      <Dialog open={Boolean(editSupplier)} onOpenChange={(open) => !open && setEditSupplier(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>Update vendor tax, contact, and billing attributes.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <FieldSet form={editForm} setForm={setEditForm} nameExample={nameExample} />
          </div>
          {updateSupplier.isError && <ErrorState error={updateSupplier.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSupplier(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => editSupplier && updateSupplier.mutate({ id: editSupplier.id, values: cleanForm(editForm) })}
              disabled={!editForm.name.trim() || updateSupplier.isPending}
            >
              {updateSupplier.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
