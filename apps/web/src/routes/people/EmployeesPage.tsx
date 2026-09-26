import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Clock,
  Download,
  Eye,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { EmployeeDrawer } from "@/components/entities/EmployeeDrawer";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
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
import {
  EMPLOYEE_STATUS_LABELS,
  employeeName,
  type Department,
  type Employee,
} from "@/lib/people";

interface Branch {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  name: string;
}

const PAGE_SIZE = 25;

export function EmployeesPage() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const {
    data: employees,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["employees"],
    queryFn: () => apiFetch<Employee[]>("/employees"),
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiFetch<Department[]>("/departments"),
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiFetch<Branch[]>("/branches"),
  });

  const { data: designations } = useQuery({
    queryKey: ["designations"],
    queryFn: () => apiFetch<Designation[]>("/designations"),
  });

  const deptById = useMemo(
    () => new Map((departments ?? []).map((d) => [d.id, d.name])),
    [departments]
  );
  const branchById = useMemo(
    () => new Map((branches ?? []).map((b) => [b.id, b.name])),
    [branches]
  );
  const designationById = useMemo(
    () => new Map((designations ?? []).map((d) => [d.id, d.name])),
    [designations]
  );

  // Metrics
  const metrics: MetricItem[] = useMemo(() => {
    if (!employees) return [];
    const total = employees.length;
    const active = employees.filter((e) => e.status === "active").length;
    const probation = employees.filter((e) => e.status === "probation").length;
    const onLeaveOrNotice = employees.filter(
      (e) => e.status === "on_leave" || e.status === "on_notice"
    ).length;

    return [
      {
        id: "total",
        label: "Total Workforce",
        value: total,
        sublabel: "Registered employees",
        icon: Users,
        color: "primary",
        onClick: () => {
          setActiveTab("all");
          setPage(0);
        },
      },
      {
        id: "active",
        label: "Active Staff",
        value: active,
        sublabel: "On duty roster",
        icon: UserCheck,
        color: "emerald",
        onClick: () => {
          setActiveTab("active");
          setPage(0);
        },
      },
      {
        id: "probation",
        label: "On Probation",
        value: probation,
        sublabel: "Review pending",
        icon: Clock,
        color: probation > 0 ? "blue" : "neutral",
        onClick: () => {
          setActiveTab("probation");
          setPage(0);
        },
      },
      {
        id: "leave-notice",
        label: "Leave / On Notice",
        value: onLeaveOrNotice,
        sublabel: "Transitions & leaves",
        icon: AlertTriangle,
        color: onLeaveOrNotice > 0 ? "amber" : "neutral",
        onClick: () => {
          setActiveTab("on_notice");
          setPage(0);
        },
      },
    ];
  }, [employees]);

  // Attention Items
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (!employees) return [];
    const itemsList: AttentionItem[] = [];

    const unassignedDept = employees.filter((e) => !e.department_id && e.status === "active");
    if (unassignedDept.length > 0) {
      itemsList.push({
        id: "unassigned-dept",
        title: `${unassignedDept.length} active employee${unassignedDept.length > 1 ? "s" : ""} without department`,
        description: "Assign departments to ensure attendance rules and reporting lines function correctly.",
        severity: "warning",
        count: unassignedDept.length,
        actionLabel: "View Staff",
        onAction: () => {
          setActiveTab("all");
          setPage(0);
        },
      });
    }

    const onNotice = employees.filter((e) => e.status === "on_notice");
    if (onNotice.length > 0) {
      itemsList.push({
        id: "on-notice",
        title: `${onNotice.length} staff member${onNotice.length > 1 ? "s" : ""} currently serving notice`,
        description: "Initiate handover tasks, knowledge transfers, and exit clearance workflows.",
        severity: "info",
        count: onNotice.length,
        actionLabel: "View Notice List",
        onAction: () => {
          setActiveTab("on_notice");
          setPage(0);
        },
      });
    }

    return itemsList;
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter((e) => {
      if (activeTab === "active" && e.status !== "active") return false;
      if (activeTab === "probation" && e.status !== "probation") return false;
      if (activeTab === "on_notice" && e.status !== "on_notice" && e.status !== "on_leave")
        return false;
      if (
        activeTab === "inactive" &&
        e.status !== "inactive" &&
        e.status !== "resigned" &&
        e.status !== "terminated"
      )
        return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const name = employeeName(e).toLowerCase();
        const code = (e.employee_code || "").toLowerCase();
        const dept = (e.department_id ? deptById.get(e.department_id) ?? "" : "").toLowerCase();
        const branch = (branchById.get(e.branch_id) ?? "").toLowerCase();
        const desig = (e.designation_id ? designationById.get(e.designation_id) ?? "" : "").toLowerCase();
        if (
          !name.includes(query) &&
          !code.includes(query) &&
          !dept.includes(query) &&
          !branch.includes(query) &&
          !desig.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [employees, activeTab, search, deptById, branchById, designationById]);

  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const pageEmployees = filteredEmployees.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Tabs
  const tabs = useMemo(() => {
    if (!employees) return [];
    return [
      { id: "all", label: "All Workforce", count: employees.length },
      {
        id: "active",
        label: "Active",
        count: employees.filter((e) => e.status === "active").length,
      },
      {
        id: "probation",
        label: "Probation",
        count: employees.filter((e) => e.status === "probation").length,
      },
      {
        id: "on_notice",
        label: "Notice / Leave",
        count: employees.filter((e) => e.status === "on_notice" || e.status === "on_leave").length,
      },
      {
        id: "inactive",
        label: "Inactive / Exited",
        count: employees.filter(
          (e) => e.status === "inactive" || e.status === "resigned" || e.status === "terminated"
        ).length,
      },
    ];
  }, [employees]);

  const exportCsv = (dataList: Employee[]) => {
    const headers = [
      "Employee Code",
      "Name",
      "Department",
      "Designation",
      "Branch",
      "Status",
      "Email",
      "Phone",
      "Joining Date",
    ];
    const rows = dataList.map((e) => [
      e.employee_code,
      employeeName(e),
      e.department_id ? deptById.get(e.department_id) ?? "" : "",
      e.designation_id ? designationById.get(e.designation_id) ?? "" : "",
      branchById.get(e.branch_id) ?? "",
      EMPLOYEE_STATUS_LABELS[e.status] ?? e.status,
      e.email ?? "",
      e.phone ?? "",
      e.joining_date,
    ]);
    downloadCsv("staff-directory.csv", [headers, ...rows]);
    toast.success(`Exported ${dataList.length} employee records`);
  };

  const handleBulkExport = () => {
    const selected = employees?.filter((e) => selectedIds.includes(e.id)) ?? [];
    exportCsv(selected.length > 0 ? selected : filteredEmployees);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === pageEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pageEmployees.map((e) => e.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <ActionableHeader
        title="Staff Directory & Workforce Operations"
        description="Oversee employee profiles, departments, designation bands, branch placements, and operational records."
        primaryAction={{
          label: "Add Employee",
          icon: Plus,
          onClick: () => setDrawerOpen(true),
        }}
        secondaryActions={[
          {
            label: "Export Directory",
            icon: Download,
            onClick: () => exportCsv(employees ?? []),
          },
          {
            label: isFetching ? "Refreshing..." : "Refresh",
            icon: RefreshCw,
            onClick: () => refetch(),
          },
        ]}
      />

      <EmployeeDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {/* 2. Metric Strip */}
      <MetricStrip metrics={metrics} />

      {/* 3. Attention Panel */}
      <AttentionPanel
        title="Workforce & Compliance Alerts"
        items={attentionItems}
        allClearMessage="All staff records are assigned to active departments, designations, and branches."
      />

      {/* 4. Saved Views & Search */}
      <SavedViews
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setPage(0);
        }}
        search={search}
        onSearchChange={(s) => {
          setSearch(s);
          setPage(0);
        }}
        searchPlaceholder="Search by name, employee code, department, branch..."
      />

      {/* 5. Main Employee Directory */}
      {isLoading && <Skeleton className="h-96 w-full" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !error && filteredEmployees.length === 0 && (
        <SmartEmptyState
          mode={search || activeTab !== "all" ? "filtered" : "first-time"}
          title={search || activeTab !== "all" ? "No matching employees" : "No employees added yet"}
          description={
            search || activeTab !== "all"
              ? "Try adjusting your search query or switching workforce status filters."
              : "Add your first employee to start tracking attendance, leaves, and payroll."
          }
          actionLabel={search || activeTab !== "all" ? "Reset Filters" : "Add First Employee"}
          onAction={() => {
            if (search || activeTab !== "all") {
              setSearch("");
              setActiveTab("all");
              setPage(0);
            } else {
              setDrawerOpen(true);
            }
          }}
        />
      )}

      {!isLoading && !error && filteredEmployees.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 p-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={
                        pageEmployees.length > 0 &&
                        pageEmployees.every((e) => selectedIds.includes(e.id))
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-3">Staff Member</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Designation & Role</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Branch Location</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageEmployees.map((e) => {
                  const isSelected = selectedIds.includes(e.id);
                  const name = employeeName(e);
                  const desig = e.designation_id ? designationById.get(e.designation_id) ?? "—" : "—";
                  const dept = e.department_id ? deptById.get(e.department_id) ?? "Unassigned" : "Unassigned";
                  const branch = branchById.get(e.branch_id) ?? "—";

                  return (
                    <tr
                      key={e.id}
                      className={`transition-colors hover:bg-muted/40 ${
                        isSelected ? "bg-muted/20" : ""
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={isSelected}
                          onChange={() => toggleSelect(e.id)}
                        />
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {e.first_name[0]}
                            {e.last_name[0]}
                          </div>
                          <div>
                            <Link
                              to={`/people/employees/${e.id}`}
                              className="font-medium text-foreground hover:text-primary hover:underline"
                            >
                              {name}
                            </Link>
                            {e.email && (
                              <p className="text-xs text-muted-foreground">{e.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {e.employee_code}
                      </td>

                      <td className="p-3 text-foreground">{desig}</td>

                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            e.department_id
                              ? "bg-secondary text-secondary-foreground"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {dept}
                        </span>
                      </td>

                      <td className="p-3 text-muted-foreground">{branch}</td>

                      <td className="p-3">
                        <StatusBadge status={e.status} />
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => navigate(`/people/employees/${e.id}`)}
                          >
                            Profile
                          </Button>
                          <RowActions
                            onQuickPeek={() => setSelectedEmployee(e)}
                            actions={[
                              {
                                label: "Open 360 Profile",
                                icon: Eye,
                                onClick: () => navigate(`/people/employees/${e.id}`),
                              },
                              {
                                label: "Quick Details",
                                icon: UserCheck,
                                onClick: () => setSelectedEmployee(e),
                              },
                              ...(e.email
                                ? [
                                    {
                                      label: "Copy Email",
                                      icon: Mail,
                                      onClick: () => {
                                        navigator.clipboard.writeText(e.email!);
                                        toast.success("Email copied to clipboard");
                                      },
                                    },
                                  ]
                               : []),
                              ...(e.phone
                                ? [
                                    {
                                      label: "Copy Phone",
                                      icon: Phone,
                                      onClick: () => {
                                        navigator.clipboard.writeText(e.phone!);
                                        toast.success("Phone copied to clipboard");
                                      },
                                    },
                                  ]
                               : []),
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, filteredEmployees.length)} of{" "}
                {filteredEmployees.length} employees
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 6. Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        actions={[
          {
            label: "Export Selected",
            icon: Download,
            onClick: handleBulkExport,
          },
        ]}
      />

      {/* 7. Quick Employee 360 Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        title={selectedEmployee ? employeeName(selectedEmployee) : "Staff Profile"}
        subtitle={selectedEmployee ? `Code: ${selectedEmployee.employee_code}` : undefined}
        badge={selectedEmployee?.status ? <StatusBadge status={selectedEmployee.status} /> : undefined}
        metrics={[
          {
            label: "Department",
            value: selectedEmployee?.department_id
              ? deptById.get(selectedEmployee.department_id) ?? "Unassigned"
              : "Unassigned",
          },
          {
            label: "Role",
            value: selectedEmployee?.designation_id
              ? designationById.get(selectedEmployee.designation_id) ?? "—"
              : "—",
          },
          {
            label: "Branch",
            value: selectedEmployee?.branch_id
              ? branchById.get(selectedEmployee.branch_id) ?? "—"
              : "—",
          },
          {
            label: "Joined",
            value: selectedEmployee?.joining_date ?? "—",
          },
        ]}
        actions={
          selectedEmployee ? (
            <Button
              className="gap-1.5"
              onClick={() => {
                navigate(`/people/employees/${selectedEmployee.id}`);
              }}
            >
              <Eye className="h-4 w-4" />
              Open Employee 360
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-border p-3 text-xs">
            <h4 className="font-semibold uppercase tracking-wider text-muted-foreground">
              Contact & Placement
            </h4>
            <div className="grid grid-cols-2 gap-2 text-foreground">
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{selectedEmployee?.email || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <p className="font-medium">{selectedEmployee?.phone || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">City:</span>
                <p className="font-medium">{selectedEmployee?.city || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Employment Type:</span>
                <p className="font-medium uppercase">{selectedEmployee?.employment_type || "Full Time"}</p>
              </div>
            </div>
          </div>
        </div>
      </DetailDrawer>
    </div>
  );
}
