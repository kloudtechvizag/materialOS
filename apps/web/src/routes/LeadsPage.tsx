import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Download,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { downloadCsv } from "@/lib/csv";
import { formatINR, formatINRCompact } from "@/lib/format";

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
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};
const STATUS_ORDER = ["new", "contacted", "qualified", "proposal", "won", "lost"];

type LeadForm = {
  name: string;
  company_name: string;
  phone: string;
  email: string;
  source: string;
  estimated_value: string;
  notes: string;
};
const BLANK_FORM: LeadForm = {
  name: "",
  company_name: "",
  phone: "",
  email: "",
  source: "",
  estimated_value: "",
  notes: "",
};

export function LeadsPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(BLANK_FORM);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [convertForm, setConvertForm] = useState({ billing_state: "", credit_limit: "", credit_days: "" });
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  // Filters & selection
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    data: leads,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["leads"],
    queryFn: () => apiFetch<Lead[]>("/leads"),
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
    onSuccess: (newLead) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Lead "${newLead.company_name || newLead.name}" created.`);
      setAddOpen(false);
      setAddForm(BLANK_FORM);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch<Lead>(`/leads/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead status updated.");
    },
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(`Converted to customer: ${data.customer.name}`);
      setConvertLead(null);
      setConvertForm({ billing_state: "", credit_limit: "", credit_days: "" });
    },
  });

  // Filtered leads
  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    return leads.filter((l) => {
      if (activeTab === "open" && ["won", "lost"].includes(l.status)) return false;
      if (activeTab === "new" && l.status !== "new") return false;
      if (activeTab === "qualified" && l.status !== "qualified" && l.status !== "proposal") return false;
      if (activeTab === "won" && l.status !== "won") return false;
      if (activeTab === "lost" && l.status !== "lost") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = l.name.toLowerCase().includes(q);
        const matchComp = (l.company_name || "").toLowerCase().includes(q);
        const matchPhone = (l.phone || "").includes(q);
        const matchSource = (l.source || "").toLowerCase().includes(q);
        if (!matchName && !matchComp && !matchPhone && !matchSource) return false;
      }

      return true;
    });
  }, [leads, activeTab, searchQuery]);

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!leads) return [];
    const totalCount = leads.length;
    const totalVal = leads.reduce((sum, l) => sum + Number(l.estimated_value || 0), 0);
    const openLeads = leads.filter((l) => !["won", "lost"].includes(l.status));
    const openVal = openLeads.reduce((sum, l) => sum + Number(l.estimated_value || 0), 0);
    const qualifiedCount = leads.filter((l) => l.status === "qualified" || l.status === "proposal").length;
    const wonCount = leads.filter((l) => l.status === "won").length;

    return [
      {
        id: "total",
        label: "Total Pipeline",
        value: totalCount,
        subvalue: formatINRCompact(totalVal),
        icon: Target,
        color: "slate",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "open",
        label: "Active Opportunities",
        value: openLeads.length,
        subvalue: formatINRCompact(openVal),
        icon: TrendingUp,
        color: "sky",
        onClick: () => setActiveTab("open"),
      },
      {
        id: "qualified",
        label: "Qualified & Proposal",
        value: qualifiedCount,
        subvalue: "High probability",
        icon: Sparkles,
        color: "amber",
        onClick: () => setActiveTab("qualified"),
      },
      {
        id: "won",
        label: "Won / Converted",
        value: wonCount,
        subvalue: "Closed revenue",
        icon: Trophy,
        color: "emerald",
        onClick: () => setActiveTab("won"),
      },
    ];
  }, [leads]);

  // Attention items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!leads) return [];
    const itemsList: AttentionItem[] = [];

    const newLeads = leads.filter((l) => l.status === "new");
    if (newLeads.length > 0) {
      itemsList.push({
        id: "new-leads",
        title: `${newLeads.length} Uncontacted New Lead${newLeads.length > 1 ? "s" : ""}`,
        count: newLeads.length,
        description: "Prospects awaiting first call or qualification outreach.",
        severity: "critical",
        actionLabel: "View New Leads",
        onAction: () => setActiveTab("new"),
      });
    }

    const proposals = leads.filter((l) => l.status === "proposal");
    if (proposals.length > 0) {
      itemsList.push({
        id: "proposals",
        title: `${proposals.length} Proposal${proposals.length > 1 ? "s" : ""} Awaiting Closing`,
        count: proposals.length,
        description: "Commercial quotes sent to prospect; follow up to convert to confirmed customer.",
        severity: "warning",
        actionLabel: "View Proposals",
        onAction: () => setActiveTab("qualified"),
      });
    }

    return itemsList;
  }, [leads]);

  // Saved view tabs
  const viewTabs = useMemo(() => {
    if (!leads) return [];
    const openCount = leads.filter((l) => !["won", "lost"].includes(l.status)).length;
    const newCount = leads.filter((l) => l.status === "new").length;
    const qualifiedCount = leads.filter((l) => l.status === "qualified" || l.status === "proposal").length;
    const wonCount = leads.filter((l) => l.status === "won").length;
    const lostCount = leads.filter((l) => l.status === "lost").length;

    return [
      { id: "all", label: "All Leads", count: leads.length },
      { id: "open", label: "Open Pipeline", count: openCount },
      { id: "new", label: "New", count: newCount },
      { id: "qualified", label: "Qualified", count: qualifiedCount },
      { id: "won", label: "Won", count: wonCount },
      { id: "lost", label: "Lost", count: lostCount },
    ];
  }, [leads]);

  // Bulk actions
  const allSelected = filteredLeads.length > 0 && selectedIds.length === filteredLeads.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map((l) => l.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleExportCsv = (rowsToExport = filteredLeads) => {
    downloadCsv("leads-pipeline", [
      ["Lead Name", "Company", "Phone", "Email", "Source", "Status", "Estimated Value"],
      ...rowsToExport.map((l) => [
        l.name,
        l.company_name || "",
        l.phone || "",
        l.email || "",
        l.source || "",
        l.status,
        l.estimated_value || "0",
      ]),
    ]);
    toast.success(`Exported ${rowsToExport.length} leads to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Leads &amp; Opportunities"
        subtitle="Pre-sales pipeline: Inbound / Referral → Contacted → Qualified → Proposal → Convert to Customer."
        badge={leads ? `${leads.length} leads` : undefined}
        primaryAction={{
          label: "Add Lead",
          icon: Plus,
          onClick: () => setAddOpen(true),
        }}
        secondaryActions={[
          {
            label: "Export CSV",
            icon: Download,
            onClick: () => handleExportCsv(),
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
        title="Pipeline Velocity &amp; Outreach Alerts"
        items={attentionItems}
        allClearMessage="Deal pipeline is progressing. All inbound leads have received outreach."
      />

      {/* 4. Saved Views & Search */}
      <SavedViews
        tabs={viewTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search lead name, company, phone, source..."
      />

      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* Empty states */}
      {leads && leads.length === 0 && (
        <SmartEmptyState
          type="first-time"
          icon={Target}
          title="No leads in pipeline yet"
          description="Capture prospect inquiries from referrals, trade visits, and digital campaigns to nurture them into buying customers."
          primaryAction={{
            label: "Create First Lead",
            icon: Plus,
            onClick: () => setAddOpen(true),
          }}
        />
      )}

      {leads && leads.length > 0 && filteredLeads.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No leads match your filter"
          description={`No opportunities found in view "${activeTab}" matching "${searchQuery}".`}
          primaryAction={{
            label: "Reset Filter",
            onClick: () => {
              setActiveTab("all");
              setSearchQuery("");
            },
          }}
        />
      )}

      {/* 5. Action-First Data Grid */}
      {filteredLeads.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                </th>
                <th className="px-4 py-3 font-medium">Lead / Account</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Contact Details</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Source</th>
                <th className="px-4 py-3 font-medium text-right">Est. Value</th>
                <th className="px-4 py-3 font-medium">Pipeline Stage</th>
                <th className="w-32 px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="group transition-colors hover:bg-accent/40 cursor-pointer"
                  onClick={() => setDetailLead(lead)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(lead.id)}
                      onCheckedChange={() => toggleSelectOne(lead.id)}
                      aria-label={`Select ${lead.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">
                      {lead.company_name || lead.name}
                    </div>
                    {lead.company_name && (
                      <div className="text-xs text-muted-foreground">{lead.name}</div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span>{lead.phone ?? "No phone"}</span>
                    </div>
                    {lead.email && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span>{lead.email}</span>
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {lead.source ? (
                      <Badge variant="outline" className="text-xs font-normal">
                        {lead.source}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {lead.estimated_value ? formatINR(lead.estimated_value) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={lead.status} />
                      {lead.converted_customer_id && (
                        <Link
                          to={`/customers/${lead.converted_customer_id}`}
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Customer 360 &rarr;
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {!lead.converted_customer_id && lead.status !== "lost" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={() => setConvertLead(lead)}
                        >
                          Convert
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {STATUS_ORDER.filter((s) => s !== lead.status && s !== "won").map((s) => (
                            <DropdownMenuItem
                              key={s}
                              onClick={() => updateStatus.mutate({ id: lead.id, status: s })}
                            >
                              Mark as {STATUS_LABEL[s]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <RowActions
                        onView={() => setDetailLead(lead)}
                        onCopy={() => {
                          navigator.clipboard.writeText(lead.name);
                          toast.success(`Copied ${lead.name}`);
                        }}
                        viewLabel="Inspect Lead"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            onClick: () => {
              const selectedRows = filteredLeads.filter((l) => selectedIds.includes(l.id));
              handleExportCsv(selectedRows);
            },
          },
        ]}
      />

      {/* 7. Contextual 360 Detail Drawer */}
      <DetailDrawer
        open={Boolean(detailLead)}
        onOpenChange={(open) => !open && setDetailLead(null)}
        title={detailLead ? detailLead.company_name || detailLead.name : ""}
        subtitle={detailLead?.company_name ? `Contact: ${detailLead.name}` : undefined}
        badge={detailLead ? <StatusBadge status={detailLead.status} /> : undefined}
        fullRecordHref={
          detailLead?.converted_customer_id
            ? `/customers/${detailLead.converted_customer_id}`
            : undefined
        }
        fullRecordLabel="Open Customer 360"
        metrics={
          detailLead
            ? [
                {
                  label: "Estimated Deal Value",
                  value: detailLead.estimated_value ? formatINR(detailLead.estimated_value) : "—",
                },
                { label: "Stage", value: (STATUS_LABEL[detailLead.status] ?? detailLead.status).toUpperCase() },
              ]
            : []
        }
        sections={
          detailLead
            ? [
                {
                  title: "Contact Information",
                  content: (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-border/40 py-1">
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="font-medium">{detailLead.phone || "No phone on file"}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 py-1">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{detailLead.email || "No email on file"}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 py-1">
                        <span className="text-muted-foreground">Acquisition Source:</span>
                        <span className="font-medium">{detailLead.source || "Direct inquiry"}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Notes & Interaction History",
                  content: (
                    <div className="rounded-md bg-muted/40 p-3 text-xs text-foreground">
                      {detailLead.notes || "No notes logged for this prospect yet."}
                    </div>
                  ),
                },
                {
                  title: "Pipeline Actions",
                  content: (
                    <div className="space-y-2">
                      {!detailLead.converted_customer_id && detailLead.status !== "lost" && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            const l = detailLead;
                            setDetailLead(null);
                            setConvertLead(l);
                          }}
                        >
                          <ArrowRight className="mr-1.5 h-4 w-4" /> Convert to Active Customer
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]
            : []
        }
      />

      {/* 8. Add Lead Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Prospect / Lead</DialogTitle>
            <DialogDescription>
              Record prospect inquiries to nurture through qualification and quoting stages.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Contact Name *</Label>
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ramesh Kumar"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Company Name</Label>
              <Input
                value={addForm.company_name}
                onChange={(e) => setAddForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder="e.g. Kumar Constructions Pvt Ltd"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={addForm.phone}
                onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="ramesh@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Input
                value={addForm.source}
                onChange={(e) => setAddForm((f) => ({ ...f, source: e.target.value }))}
                placeholder="Referral / Expo / Web"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Deal Value (₹)</Label>
              <Input
                type="number"
                value={addForm.estimated_value}
                onChange={(e) => setAddForm((f) => ({ ...f, estimated_value: e.target.value }))}
                placeholder="500000"
              />
            </div>
          </div>
          {createLead.isError && <ErrorState error={createLead.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createLead.mutate(addForm)}
              disabled={!addForm.name.trim() || createLead.isPending}
            >
              {createLead.isPending ? "Saving..." : "Save Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 9. Convert to Customer Dialog */}
      <Dialog open={convertLead !== null} onOpenChange={(open) => !open && setConvertLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Lead to Active Customer</DialogTitle>
            <DialogDescription>
              Creates an institutional customer record from &quot;{convertLead?.company_name || convertLead?.name}&quot; for sales orders and GST invoicing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Billing State (Required for GST Tax Determination) *</Label>
              <Input
                value={convertForm.billing_state}
                onChange={(e) => setConvertForm((f) => ({ ...f, billing_state: e.target.value }))}
                placeholder="e.g. Andhra Pradesh, Telangana"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Credit Limit (₹)</Label>
                <Input
                  type="number"
                  value={convertForm.credit_limit}
                  onChange={(e) => setConvertForm((f) => ({ ...f, credit_limit: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Credit Days</Label>
                <Input
                  type="number"
                  value={convertForm.credit_days}
                  onChange={(e) => setConvertForm((f) => ({ ...f, credit_days: e.target.value }))}
                  placeholder="30"
                />
              </div>
            </div>
          </div>
          {convert.isError && <ErrorState error={convert.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertLead(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => convertLead && convert.mutate({ id: convertLead.id, values: convertForm })}
              disabled={convert.isPending}
            >
              {convert.isPending ? "Converting..." : "Confirm & Convert Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
