import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building,
  Building2,
  Download,
  MapPin,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionableHeader,
  AttentionPanel,
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

interface Customer {
  id: string;
  name: string;
}

interface ProjectSite {
  id: string;
  name: string;
  state: string;
  city?: string;
}

interface Project {
  id: string;
  customer_id: string;
  name: string;
  status: string;
  sites: ProjectSite[];
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    name: "",
    site_name: "",
    site_state: "",
    site_city: "",
  });

  // Filters & selection
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectedProject, setInspectedProject] = useState<Project | null>(null);

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiFetch<Customer[]>("/customers"),
  });

  const {
    data: projects,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<Project[]>("/projects"),
  });

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    (customers || []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [customers]);

  const createProject = useMutation({
    mutationFn: () =>
      apiFetch<Project>("/projects", {
        method: "POST",
        body: {
          customer_id: form.customer_id,
          name: form.name,
          sites: form.site_name
            ? [{ name: form.site_name, state: form.site_state, city: form.site_city }]
            : [],
        },
      }),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`Project "${p.name}" created successfully.`);
      setShowForm(false);
      setForm({ customer_id: "", name: "", site_name: "", site_state: "", site_city: "" });
    },
  });

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p) => {
      if (activeTab === "active" && p.status !== "active") return false;
      if (activeTab === "multi_site" && p.sites.length <= 1) return false;
      if (activeTab === "no_sites" && p.sites.length > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const custName = (customerMap.get(p.customer_id) || "").toLowerCase();
        const matchCust = custName.includes(q);
        const matchSites = p.sites.some(
          (s) => s.name.toLowerCase().includes(q) || s.state.toLowerCase().includes(q)
        );
        if (!matchName && !matchCust && !matchSites) return false;
      }

      return true;
    });
  }, [projects, activeTab, searchQuery, customerMap]);

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!projects) return [];
    const totalCount = projects.length;
    const totalSites = projects.reduce((sum, p) => sum + p.sites.length, 0);
    const uniqueCusts = new Set(projects.map((p) => p.customer_id)).size;
    const multiSiteCount = projects.filter((p) => p.sites.length > 1).length;

    return [
      {
        id: "total",
        label: "Total Projects",
        value: totalCount,
        subvalue: "Commercial containers",
        icon: Building,
        color: "slate",
        onClick: () => setActiveTab("all"),
      },
      {
        id: "sites",
        label: "Active Delivery Sites",
        value: totalSites,
        subvalue: "Destination points",
        icon: MapPin,
        color: "emerald",
      },
      {
        id: "customers",
        label: "Accounts Served",
        value: uniqueCusts,
        subvalue: "Institutional buyers",
        icon: Users,
        color: "sky",
      },
      {
        id: "multi-site",
        label: "Multi-Site Projects",
        value: multiSiteCount,
        subvalue: "Complex deliveries",
        icon: Building2,
        color: "indigo",
        onClick: () => setActiveTab("multi_site"),
      },
    ];
  }, [projects]);

  // Attention items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!projects) return [];
    const itemsList: AttentionItem[] = [];

    const withoutSites = projects.filter((p) => p.sites.length === 0);
    if (withoutSites.length > 0) {
      itemsList.push({
        id: "no-sites",
        title: `${withoutSites.length} Project${withoutSites.length > 1 ? "s" : ""} Without Delivery Sites`,
        count: withoutSites.length,
        description: "Orders cannot generate location-specific delivery challans without a configured site.",
        severity: "warning",
        actionLabel: "View Incomplete Projects",
        onAction: () => setActiveTab("no_sites"),
      });
    }

    return itemsList;
  }, [projects]);

  // View tabs
  const viewTabs = useMemo(() => {
    if (!projects) return [];
    const multiCount = projects.filter((p) => p.sites.length > 1).length;
    const noSitesCount = projects.filter((p) => p.sites.length === 0).length;

    return [
      { id: "all", label: "All Projects", count: projects.length },
      { id: "multi_site", label: "Multi-Site", count: multiCount },
      { id: "no_sites", label: "Missing Sites", count: noSitesCount },
    ];
  }, [projects]);

  const handleExportCsv = (rowsToExport = filteredProjects) => {
    downloadCsv("projects-registry", [
      ["Project Name", "Customer", "Status", "Sites Count", "Site Names"],
      ...rowsToExport.map((p) => [
        p.name,
        customerMap.get(p.customer_id) || p.customer_id,
        p.status,
        String(p.sites.length),
        p.sites.map((s) => s.name).join(" | "),
      ]),
    ]);
    toast.success(`Exported ${rowsToExport.length} projects to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Projects &amp; Job Sites"
        subtitle="Manage customer commercial accounts, site-specific requirements, delivery addresses, and job contracts."
        badge={projects ? `${projects.length} projects` : undefined}
        primaryAction={{
          label: showForm ? "Cancel" : "Add Project",
          icon: Plus,
          onClick: () => setShowForm((v) => !v),
          variant: showForm ? "outline" : "default",
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
        title="Project Configuration Alerts"
        items={attentionItems}
        allClearMessage="All customer projects have configured delivery sites and active client assignments."
      />

      {/* 4. Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-base font-semibold">New Customer Project &amp; Job Site</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Customer / Client *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                >
                  <option value="">Select customer account...</option>
                  {customers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Project Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Green Valley Luxury Towers, Phase II"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Primary Delivery Site
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Site Name</Label>
                  <Input
                    value={form.site_name}
                    onChange={(e) => setForm((f) => ({ ...f, site_name: e.target.value }))}
                    placeholder="e.g. Main Godown / Tower A"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input
                    value={form.site_city}
                    onChange={(e) => setForm((f) => ({ ...f, site_city: e.target.value }))}
                    placeholder="e.g. Visakhapatnam"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input
                    value={form.site_state}
                    onChange={(e) => setForm((f) => ({ ...f, site_state: e.target.value }))}
                    placeholder="e.g. Andhra Pradesh"
                  />
                </div>
              </div>
            </div>

            {createProject.isError && <ErrorState error={createProject.error} />}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createProject.mutate()}
                disabled={!form.customer_id || !form.name.trim() || createProject.isPending}
              >
                {createProject.isPending ? "Saving Project..." : "Save Project"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Saved Views & Search */}
      <SavedViews
        tabs={viewTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search project, customer, or delivery site..."
      />

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {/* Empty states */}
      {projects && projects.length === 0 && !showForm && (
        <SmartEmptyState
          type="first-time"
          icon={Building}
          title="No customer projects created yet"
          description="Create commercial projects to organize site deliveries, manage bill-to / ship-to hierarchies, and track order fulfillment."
          primaryAction={{
            label: "Create First Project",
            icon: Plus,
            onClick: () => setShowForm(true),
          }}
        />
      )}

      {projects && projects.length > 0 && filteredProjects.length === 0 && (
        <SmartEmptyState
          type="filtered"
          title="No projects match your search"
          description={`No projects found matching "${searchQuery}" in ${activeTab} view.`}
          primaryAction={{
            label: "Reset Filter",
            onClick: () => {
              setActiveTab("all");
              setSearchQuery("");
            },
          }}
        />
      )}

      {/* 6. Action-First Data Grid */}
      {filteredProjects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((p) => {
            const customerName = customerMap.get(p.customer_id);

            return (
              <Card
                key={p.id}
                className="cursor-pointer border-border transition-all hover:border-primary/50 hover:shadow-sm"
                onClick={() => setInspectedProject(p)}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold text-foreground line-clamp-1">
                        {p.name}
                      </CardTitle>
                      {customerName ? (
                        <Link
                          to={`/customers/${p.customer_id}`}
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {customerName}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">General Account</span>
                      )}
                    </div>
                    <StatusBadge status={p.status || "active"} />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{p.sites.length} Delivery Site{p.sites.length !== 1 ? "s" : ""}</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {p.sites.length === 0 ? (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          No sites specified
                        </span>
                      ) : (
                        p.sites.map((s) => (
                          <Badge key={s.id} variant="secondary" className="text-[11px] font-normal">
                            {s.name} {s.state ? `(${s.state})` : ""}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                    <span className="text-muted-foreground">Inspect details</span>
                    <RowActions
                      onView={() => setInspectedProject(p)}
                      onCopy={() => {
                        navigator.clipboard.writeText(p.name);
                        toast.success(`Copied ${p.name}`);
                      }}
                      viewLabel="Inspect Project"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 7. Contextual 360 Detail Drawer */}
      <DetailDrawer
        open={Boolean(inspectedProject)}
        onOpenChange={(open) => !open && setInspectedProject(null)}
        title={inspectedProject ? inspectedProject.name : ""}
        subtitle={
          inspectedProject && customerMap.get(inspectedProject.customer_id)
            ? `Client: ${customerMap.get(inspectedProject.customer_id)}`
            : undefined
        }
        badge={inspectedProject ? <StatusBadge status={inspectedProject.status || "active"} /> : undefined}
        metrics={
          inspectedProject
            ? [
                { label: "Sites Count", value: String(inspectedProject.sites.length) },
                { label: "Status", value: (inspectedProject.status || "ACTIVE").toUpperCase() },
              ]
            : []
        }
        sections={
          inspectedProject
            ? [
                {
                  title: "Delivery Sites & Locations",
                  content: (
                    <div className="space-y-2">
                      {inspectedProject.sites.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No sites added yet.</p>
                      ) : (
                        inspectedProject.sites.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between rounded-md border border-border/60 p-2.5 text-xs"
                          >
                            <span className="font-semibold text-foreground">{s.name}</span>
                            <span className="text-muted-foreground">
                              {s.city ? `${s.city}, ` : ""}{s.state}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  ),
                },
                {
                  title: "Commercial Links",
                  content: (
                    <div className="space-y-2">
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link to={`/customers/${inspectedProject.customer_id}`}>
                          <Users className="mr-1.5 h-4 w-4" /> Open Customer 360
                        </Link>
                      </Button>
                      <Button asChild size="sm" className="w-full">
                        <Link to={`/quotations/new?customer_id=${inspectedProject.customer_id}&project_id=${inspectedProject.id}`}>
                          + Create Quotation for this Project
                        </Link>
                      </Button>
                    </div>
                  ),
                },
              ]
            : []
        }
      />
    </div>
  );
}
