import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileText,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  type AttentionItem,
  type MetricItem,
} from "@/components/workspace";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatINR, formatINRCompact } from "@/lib/format";
import { useIndustryProfile } from "@/lib/industryProfile";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  gstin: string | null;
  phone: string | null;
  billing_state: string | null;
  credit_limit: string;
}

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    billing_state: "Andhra Pradesh",
    credit_limit: "0",
    credit_days: "30",
  });

  const [activeView, setActiveView] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewCustomer, setPreviewCustomer] = useState<Customer | null>(null);

  const { profile } = useIndustryProfile();
  const nameExample = profile?.terminology?.customer_name_example ?? "Sri Balaji Constructions";

  const {
    data: customers = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiFetch<Customer[]>("/customers"),
  });

  const createCustomer = useMutation({
    mutationFn: () =>
      apiFetch<Customer>("/customers", {
        method: "POST",
        body: {
          ...form,
          credit_limit: Number(form.credit_limit) || 0,
          credit_days: Number(form.credit_days) || 30,
        },
      }),
    onSuccess: (newCust) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(`Customer ${newCust.name} added successfully`);
      setShowForm(false);
      setForm({
        name: "",
        phone: "",
        billing_state: "Andhra Pradesh",
        credit_limit: "0",
        credit_days: "30",
      });
    },
  });

  // Business calculations
  const {
    withCreditLimit,
    missingGstin,
    totalCreditExtended,
    uniqueStates,
    highCreditCount,
  } = useMemo(() => {
    let withCredit = 0;
    let noGst = 0;
    let totalCredit = 0;
    let highCredit = 0;
    const states = new Set<string>();

    for (const c of customers) {
      const limit = Number(c.credit_limit) || 0;
      totalCredit += limit;
      if (limit > 0) withCredit++;
      if (limit >= 500000) highCredit++;
      if (!c.gstin) noGst++;
      if (c.billing_state) states.add(c.billing_state);
    }

    return {
      withCreditLimit: withCredit,
      missingGstin: noGst,
      totalCreditExtended: totalCredit,
      uniqueStates: Array.from(states).sort(),
      highCreditCount: highCredit,
    };
  }, [customers]);

  // Metric Strip
  const metrics: MetricItem[] = useMemo(
    () => [
      {
        id: "total",
        label: "Total Accounts",
        value: customers.length,
        sublabel: `${uniqueStates.length} states active`,
        icon: Users,
        color: "violet",
        active: activeView === "all",
        onClick: () => setActiveView("all"),
      },
      {
        id: "credit",
        label: "Credit Accounts",
        value: withCreditLimit,
        sublabel: "Pre-authorized credit",
        icon: CreditCard,
        color: "emerald",
        active: activeView === "credit",
        onClick: () => setActiveView("credit"),
      },
      {
        id: "exposure",
        label: "Total Credit Exposure",
        value: formatINRCompact(totalCreditExtended),
        sublabel: `${highCreditCount} high-limit accounts`,
        icon: ShieldAlert,
        color: "sky",
      },
      {
        id: "missing-gst",
        label: "Missing GSTIN",
        value: missingGstin,
        sublabel: "Non-B2B tax risk",
        icon: AlertTriangle,
        color: missingGstin > 0 ? "amber" : "slate",
        active: activeView === "missing_gst",
        onClick: () => setActiveView("missing_gst"),
      },
    ],
    [
      customers.length,
      uniqueStates.length,
      withCreditLimit,
      totalCreditExtended,
      highCreditCount,
      missingGstin,
      activeView,
    ]
  );

  // Attention / Exceptions
  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];

    if (missingGstin > 0) {
      items.push({
        id: "att-gstin",
        title: `${missingGstin} customer${missingGstin > 1 ? "s" : ""} without GSTIN`,
        severity: "warning",
        count: missingGstin,
        description: "Missing GSTIN blocks compliant B2B tax invoice and e-way bill generation.",
        actionLabel: "Filter accounts",
        onClick: () => setActiveView("missing_gst"),
      });
    }

    if (highCreditCount > 0) {
      items.push({
        id: "att-credit",
        title: `${highCreditCount} high-exposure credit account${highCreditCount > 1 ? "s" : ""}`,
        severity: "info",
        count: highCreditCount,
        description: "Accounts with approved credit limit exceeding ₹5,00,000.",
        actionLabel: "Review high credit",
        onClick: () => setActiveView("high_credit"),
      });
    }

    return items;
  }, [missingGstin, highCreditCount]);

  // Views & Filtering
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const limit = Number(c.credit_limit) || 0;

      // Saved views
      if (activeView === "credit" && limit <= 0) return false;
      if (activeView === "cash" && limit > 0) return false;
      if (activeView === "missing_gst" && Boolean(c.gstin)) return false;
      if (activeView === "high_credit" && limit < 500000) return false;

      // State filter
      if (selectedState && c.billing_state !== selectedState) return false;

      // Text search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const name = c.name.toLowerCase();
        const phone = (c.phone ?? "").toLowerCase();
        const gstin = (c.gstin ?? "").toLowerCase();
        const state = (c.billing_state ?? "").toLowerCase();

        if (!name.includes(q) && !phone.includes(q) && !gstin.includes(q) && !state.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [customers, activeView, selectedState, search]);

  // Bulk selections
  function toggleSelectAll() {
    if (selectedIds.length === filteredCustomers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCustomers.map((c) => c.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleExportCsv() {
    const rows = filteredCustomers.map((c) => [
      c.name,
      c.phone ?? "",
      c.gstin ?? "",
      c.billing_state ?? "",
      c.credit_limit,
    ]);
    downloadCsv("materialos_customers.csv", [
      ["Customer Name", "Phone", "GSTIN", "Billing State", "Credit Limit"],
      ...rows,
    ]);
    toast.success(`Exported ${filteredCustomers.length} customer records`);
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Customers & Accounts"
        subtitle="Customer directory, billing states, and pre-authorized credit limits."
        badge={{ label: `${customers.length} Accounts`, variant: "outline" }}
        primaryAction={{
          label: showForm ? "Cancel" : "Add Customer",
          icon: showForm ? undefined : Plus,
          onClick: () => setShowForm((v) => !v),
          variant: showForm ? "outline" : "default",
        }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: handleExportCsv,
            disabled: customers.length === 0,
          },
          {
            label: "Refresh",
            icon: RefreshCw,
            onClick: () => refetch(),
            disabled: isRefetching,
          },
        ]}
      />

      {/* 2. Context KPI Strip */}
      <MetricStrip metrics={metrics} />

      {/* 3. Attention / Exceptions */}
      <AttentionPanel items={attentionItems} />

      {/* Quick Add Customer Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md animate-in fade-in slide-in-from-top-2">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">New Customer Account</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Credit limits and billing state will govern tax and credit control checks on orders.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cust-name">Customer / Company Name *</Label>
                <Input
                  id="cust-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={nameExample}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-phone">Phone Number</Label>
                <Input
                  id="cust-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-state">Billing State</Label>
                <Input
                  id="cust-state"
                  value={form.billing_state}
                  onChange={(e) => setForm((f) => ({ ...f, billing_state: e.target.value }))}
                  placeholder="Andhra Pradesh"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-credit">Credit Limit (₹)</Label>
                <Input
                  id="cust-credit"
                  type="number"
                  value={form.credit_limit}
                  onChange={(e) => setForm((f) => ({ ...f, credit_limit: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-days">Credit Days</Label>
                <Input
                  id="cust-days"
                  type="number"
                  value={form.credit_days}
                  onChange={(e) => setForm((f) => ({ ...f, credit_days: e.target.value }))}
                />
              </div>
            </div>

            {createCustomer.isError && <ErrorState error={createCustomer.error} />}

            <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createCustomer.mutate()}
                disabled={!form.name.trim() || createCustomer.isPending}
              >
                {createCustomer.isPending ? "Saving..." : "Save Customer"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Saved Views & Smart Filters */}
      <SavedViews
        views={[
          { id: "all", label: "All Customers", count: customers.length },
          { id: "credit", label: "Credit Accounts", count: withCreditLimit },
          { id: "cash", label: "Cash Only", count: customers.length - withCreditLimit },
          { id: "missing_gst", label: "Missing GSTIN", count: missingGstin },
          { id: "high_credit", label: "High Exposure (≥₹5L)" },
        ]}
        activeView={activeView}
        onViewChange={setActiveView}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search customer, phone, GSTIN..."
        hasActiveFilters={Boolean(selectedState || search || activeView !== "all")}
        onClearFilters={() => {
          setSelectedState("");
          setSearch("");
          setActiveView("all");
        }}
      >
        {uniqueStates.length > 0 && (
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            aria-label="Filter by state"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-medium"
          >
            <option value="">All States ({uniqueStates.length})</option>
            {uniqueStates.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </SavedViews>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* Empty States */}
      {!isLoading && customers.length === 0 && !showForm && (
        <SmartEmptyState
          type="first-time"
          icon={Users}
          title="No customers yet"
          description="Add your first customer to start creating quotations, orders, and recording collections."
          tip="You can also import existing customers directly from Tally or Busy."
          primaryAction={{
            label: "Add Customer",
            icon: Plus,
            onClick: () => setShowForm(true),
          }}
          secondaryActions={[
            {
              label: "Import Customers",
              href: "/settings/imports",
            },
          ]}
        />
      )}

      {!isLoading && customers.length > 0 && filteredCustomers.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No customers match your filters"
          description={`No accounts found matching the "${activeView}" view and active search criteria.`}
          primaryAction={{
            label: "Clear All Filters",
            onClick: () => {
              setActiveView("all");
              setSearch("");
              setSelectedState("");
            },
          }}
        />
      )}

      {/* 5. Main Workspace Table */}
      {!isLoading && filteredCustomers.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 p-3 text-center">
                    <Checkbox
                      checked={selectedIds.length === filteredCustomers.length && filteredCustomers.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3">Customer Account</th>
                  <th className="p-3">Contact & Phone</th>
                  <th className="p-3">Billing State</th>
                  <th className="p-3">GSTIN / Tax ID</th>
                  <th className="p-3 text-right">Credit Limit</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredCustomers.map((c) => {
                  const isSelected = selectedIds.includes(c.id);
                  const creditLimitNum = Number(c.credit_limit) || 0;

                  return (
                    <tr
                      key={c.id}
                      className={cn(
                        "group transition-colors hover:bg-accent/40",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      <td className="w-10 p-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(c.id)}
                          aria-label={`Select ${c.name}`}
                        />
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setPreviewCustomer(c)}
                              className="font-semibold text-foreground hover:text-primary hover:underline text-left block truncate"
                            >
                              {c.name}
                            </button>
                            <Link
                              to={`/customers/${c.id}`}
                              className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                            >
                              <span>Customer 360</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-xs text-muted-foreground">
                        {c.phone ? (
                          <div className="flex items-center gap-1.5 text-foreground">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{c.phone}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">No phone</span>
                        )}
                      </td>

                      <td className="p-3 text-xs text-muted-foreground">
                        {c.billing_state ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-70" />
                            <span>{c.billing_state}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="p-3 text-xs">
                        {c.gstin ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {c.gstin}
                          </Badge>
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            Missing GSTIN
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right font-medium font-mono text-xs">
                        {creditLimitNum > 0 ? (
                          <span className="text-foreground font-semibold">
                            {formatINR(c.credit_limit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Cash only</span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <RowActions
                          quickActions={[
                            {
                              id: "preview",
                              label: "Peek Details",
                              icon: Eye,
                              onClick: () => setPreviewCustomer(c),
                            },
                          ]}
                          actions={[
                            {
                              id: "360",
                              label: "Open Customer 360",
                              icon: ArrowRight,
                              onClick: () => {
                                window.location.href = `/customers/${c.id}`;
                              },
                            },
                            {
                              id: "new-quote",
                              label: "Create Quotation",
                              icon: FileText,
                              onClick: () => {
                                window.location.href = `/quotations/new?customer_id=${c.id}`;
                              },
                            },
                            {
                              id: "copy-name",
                              label: "Copy Customer Name",
                              icon: Copy,
                              onClick: () => {
                                navigator.clipboard.writeText(c.name);
                                toast.success(`Copied ${c.name}`);
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        totalCount={filteredCustomers.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={toggleSelectAll}
        actions={[
          {
            id: "export-selected",
            label: "Export Selected",
            icon: Download,
            onClick: () => {
              const selectedCusts = customers.filter((c) => selectedIds.includes(c.id));
              downloadCsv("materialos_selected_customers.csv", [
                ["Name", "Phone", "GSTIN", "State", "Credit Limit"],
                ...selectedCusts.map((c) => [
                  c.name,
                  c.phone ?? "",
                  c.gstin ?? "",
                  c.billing_state ?? "",
                  c.credit_limit,
                ]),
              ]);
              toast.success(`Exported ${selectedCusts.length} customers`);
            },
          },
        ]}
      />

      {/* 7. Contextual Detail Drawer */}
      {previewCustomer && (
        <DetailDrawer
          open={!!previewCustomer}
          onOpenChange={(open) => !open && setPreviewCustomer(null)}
          title={previewCustomer.name}
          subtitle={`Account ID: ${previewCustomer.id}`}
          statusBadge={
            Number(previewCustomer.credit_limit) > 0
              ? { label: "Credit Customer", variant: "success" }
              : { label: "Cash Customer", variant: "outline" }
          }
          fullRecordHref={`/customers/${previewCustomer.id}`}
          fullRecordLabel="Open Customer 360"
          primaryAction={{
            label: "New Quotation",
            href: `/quotations/new?customer_id=${previewCustomer.id}`,
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Authorized Credit Limit</p>
                <p className="text-base font-bold font-mono mt-0.5 text-foreground">
                  {formatINR(previewCustomer.credit_limit)}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">GSTIN / Tax ID</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {previewCustomer.gstin ?? "Not registered"}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Phone Number</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {previewCustomer.phone ?? "Not provided"}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Billing State</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {previewCustomer.billing_state ?? "Not provided"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Operational Workflows</p>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Link to={`/quotations/new?customer_id=${previewCustomer.id}`}>
                    <FileText className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>Create New Quotation for this Customer</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs">
                  <Link to={`/collections`}>
                    <CreditCard className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>View Outstanding Invoices in Collections</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
