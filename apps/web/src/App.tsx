import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { PortalShell } from "@/components/layout/PortalShell";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { ApprovalsPage } from "@/routes/ApprovalsPage";
import { BooksPage } from "@/routes/BooksPage";
import { BranchesPage } from "@/routes/BranchesPage";
import { CollectionsPage } from "@/routes/CollectionsPage";
import { CompanySettingsPage } from "@/routes/CompanySettingsPage";
import { Customer360Page } from "@/routes/Customer360Page";
import { CustomersPage } from "@/routes/CustomersPage";
import { DashboardPage } from "@/routes/DashboardPage";
import { GstPage } from "@/routes/GstPage";
import { DispatchBoardPage } from "@/routes/dispatch/DispatchBoardPage";
import { FleetPage } from "@/routes/dispatch/FleetPage";
import { PodCapturePage } from "@/routes/dispatch/PodCapturePage";
import { StockCountDetailPage } from "@/routes/dispatch/StockCountDetailPage";
import { StockCountsPage } from "@/routes/dispatch/StockCountsPage";
import { TransfersPage } from "@/routes/dispatch/TransfersPage";
import { TripDetailPage } from "@/routes/dispatch/TripDetailPage";
import { TripsPage } from "@/routes/dispatch/TripsPage";
import { FieldSalesPage } from "@/routes/FieldSalesPage";
import { ImportWizardPage } from "@/routes/imports/ImportWizardPage";
import { ImportsPage } from "@/routes/imports/ImportsPage";
import { InvoiceDetailPage } from "@/routes/InvoiceDetailPage";
import { ItemsPage } from "@/routes/ItemsPage";
import { LoginPage } from "@/routes/LoginPage";
import { GoodsReceiptDetailPage } from "@/routes/procurement/GoodsReceiptDetailPage";
import { PurchaseBillDetailPage } from "@/routes/procurement/PurchaseBillDetailPage";
import { PurchaseOrderDetailPage } from "@/routes/procurement/PurchaseOrderDetailPage";
import { PurchaseOrdersPage } from "@/routes/procurement/PurchaseOrdersPage";
import { Supplier360Page } from "@/routes/procurement/Supplier360Page";
import { SuppliersPage } from "@/routes/procurement/SuppliersPage";
import { ProjectsPage } from "@/routes/ProjectsPage";
import { PortalDashboardPage } from "@/routes/portal/PortalDashboardPage";
import { PortalDeliveriesPage } from "@/routes/portal/PortalDeliveriesPage";
import { PortalInvoiceDetailPage } from "@/routes/portal/PortalInvoiceDetailPage";
import { PortalInvoicesPage } from "@/routes/portal/PortalInvoicesPage";
import { PortalLoginPage } from "@/routes/portal/PortalLoginPage";
import { PortalOrdersPage } from "@/routes/portal/PortalOrdersPage";
import { PortalQuotationDetailPage } from "@/routes/portal/PortalQuotationDetailPage";
import { PortalQuotationsPage } from "@/routes/portal/PortalQuotationsPage";
import { PortalStatementPage } from "@/routes/portal/PortalStatementPage";
import { PosPage } from "@/routes/pos/PosPage";
import { PricingPage } from "@/routes/PricingPage";
import { PrintJobDetailPage } from "@/routes/printing/PrintJobDetailPage";
import { PrintJobsPage } from "@/routes/printing/PrintJobsPage";
import { PrintMachinesPage } from "@/routes/printing/PrintMachinesPage";
import { ProductionBoardPage } from "@/routes/printing/ProductionBoardPage";
import { NewQuotationPage } from "@/routes/quotations/NewQuotationPage";
import { QuotationDetailPage } from "@/routes/quotations/QuotationDetailPage";
import { QuotationsPage } from "@/routes/quotations/QuotationsPage";
import { AuditLogPage } from "@/routes/operations/AuditLogPage";
import { BackupPage } from "@/routes/operations/BackupPage";
import { CommandCenterPage } from "@/routes/operations/CommandCenterPage";
import { NotificationRulesPage } from "@/routes/operations/NotificationRulesPage";
import { AttendancePage } from "@/routes/people/AttendancePage";
import { EmployeeDetailPage } from "@/routes/people/EmployeeDetailPage";
import { EmployeesPage } from "@/routes/people/EmployeesPage";
import { LeavePage } from "@/routes/people/LeavePage";
import { PayrollPage } from "@/routes/people/PayrollPage";
import { PayrollRunDetailPage } from "@/routes/people/PayrollRunDetailPage";
import { PeopleOverviewPage } from "@/routes/people/PeopleOverviewPage";
import { SalesOrderDetailPage } from "@/routes/SalesOrderDetailPage";
import { ServerSettingsPage } from "@/routes/ServerSettingsPage";
import { IndustryConfigPage } from "@/routes/settings/IndustryConfigPage";
import { SignupPage } from "@/routes/SignupPage";
import { SubscriptionInvoicesPage } from "@/routes/settings/SubscriptionInvoicesPage";
import { SubscriptionPage } from "@/routes/settings/SubscriptionPage";
import { ReceiptSettingsPage } from "@/routes/settings/ReceiptSettingsPage";
import { SubscriptionPaymentsPage } from "@/routes/settings/SubscriptionPaymentsPage";
import { UsersPage } from "@/routes/UsersPage";
import { useAuthStore } from "@/store/auth";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequirePortalAuth({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const customerId = useAuthStore((s) => s.customerId);
  if (!accessToken || !customerId) return <Navigate to="/portal/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/server-settings" element={<ServerSettingsPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/portal/login" element={<PortalLoginPage />} />

      <Route
        element={
          <RequirePortalAuth>
            <PortalShell />
          </RequirePortalAuth>
        }
      >
        <Route path="/portal" element={<PortalDashboardPage />} />
        <Route path="/portal/quotations" element={<PortalQuotationsPage />} />
        <Route path="/portal/quotations/:quotationId" element={<PortalQuotationDetailPage />} />
        <Route path="/portal/orders" element={<PortalOrdersPage />} />
        <Route path="/portal/invoices" element={<PortalInvoicesPage />} />
        <Route path="/portal/invoices/:invoiceId" element={<PortalInvoiceDetailPage />} />
        <Route path="/portal/deliveries" element={<PortalDeliveriesPage />} />
        <Route path="/portal/statement" element={<PortalStatementPage />} />
      </Route>

      {/* Standalone, no sidebar -- this is the page a driver opens on their phone (ADR-005). */}
      <Route
        path="/pod/:challanId"
        element={
          <RequireAuth>
            <PodCapturePage />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route
          path="/pos"
          element={
            <FeatureGate
              feature="module.pos"
              title="Point of sale"
              description="Barcode/search checkout with split cash, UPI, and card payment."
              requiredPlan="Starter"
            >
              <PosPage />
            </FeatureGate>
          }
        />
        <Route path="/production-board" element={<ProductionBoardPage />} />
        <Route path="/print-jobs" element={<PrintJobsPage />} />
        <Route path="/print-jobs/:jobId" element={<PrintJobDetailPage />} />
        <Route path="/print-machines" element={<PrintMachinesPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:customerId" element={<Customer360Page />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/quotations" element={<QuotationsPage />} />
        <Route path="/quotations/new" element={<NewQuotationPage />} />
        <Route path="/quotations/:quotationId" element={<QuotationDetailPage />} />
        <Route path="/sales-orders/:orderId" element={<SalesOrderDetailPage />} />
        <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />
        <Route path="/dispatch-board" element={<DispatchBoardPage />} />
        <Route path="/fleet" element={<FleetPage />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/trips/:tripId" element={<TripDetailPage />} />
        <Route path="/stock-counts" element={<StockCountsPage />} />
        <Route path="/stock-counts/:countId" element={<StockCountDetailPage />} />
        <Route path="/transfers" element={<TransfersPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/suppliers/:supplierId" element={<Supplier360Page />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/purchase-orders/:orderId" element={<PurchaseOrderDetailPage />} />
        <Route path="/goods-receipts/:receiptId" element={<GoodsReceiptDetailPage />} />
        <Route path="/purchase-bills/:billId" element={<PurchaseBillDetailPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/field-sales" element={<FieldSalesPage />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/imports/new" element={<ImportWizardPage />} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/books" element={<BooksPage />} />
        <Route path="/gst" element={<GstPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/company-settings" element={<CompanySettingsPage />} />
        <Route path="/settings/industry" element={<IndustryConfigPage />} />
        <Route path="/people" element={<PeopleOverviewPage />} />
        <Route path="/people/employees" element={<EmployeesPage />} />
        <Route path="/people/employees/:employeeId" element={<EmployeeDetailPage />} />
        <Route path="/people/attendance" element={<AttendancePage />} />
        <Route path="/people/leave" element={<LeavePage />} />
        <Route path="/people/payroll" element={<PayrollPage />} />
        <Route path="/people/payroll/:runId" element={<PayrollRunDetailPage />} />
        <Route path="/operations" element={<CommandCenterPage />} />
        <Route path="/operations/backups" element={<BackupPage />} />
        <Route path="/operations/audit-log" element={<AuditLogPage />} />
        <Route path="/operations/notification-rules" element={<NotificationRulesPage />} />
        <Route path="/settings/subscription" element={<SubscriptionPage />} />
        <Route path="/settings/subscription/invoices" element={<SubscriptionInvoicesPage />} />
        <Route path="/settings/subscription/payments" element={<SubscriptionPaymentsPage />} />
        <Route path="/settings/receipts" element={<ReceiptSettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
