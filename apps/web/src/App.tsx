import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { PortalShell } from "@/components/layout/PortalShell";
import { GuardianPortalShell } from "@/components/layout/GuardianPortalShell";
import { PlatformLayout } from "@/routes/platform/PlatformLayout";
import { PlatformAdminsPage } from "@/routes/platform/PlatformAdminsPage";
import { PlatformLoginPage } from "@/routes/platform/PlatformLoginPage";
import { PlatformPlansPage } from "@/routes/platform/PlatformPlansPage";
import { PlatformSupportTicketDetailPage } from "@/routes/platform/PlatformSupportTicketDetailPage";
import { PlatformSupportTicketsPage } from "@/routes/platform/PlatformSupportTicketsPage";
import { PlatformTenantAuditLogPage } from "@/routes/platform/PlatformTenantAuditLogPage";
import { PlatformTenantDetailPage } from "@/routes/platform/PlatformTenantDetailPage";
import { PlatformTenantsPage } from "@/routes/platform/PlatformTenantsPage";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { RequireModule } from "@/components/industry/RequireModule";
import { AboutPage as MarketingAboutPage } from "@/marketing/pages/AboutPage";
import { BookDemoPage } from "@/marketing/pages/BookDemoPage";
import { ComparePage } from "@/marketing/pages/ComparePage";
import { ContactPage as MarketingContactPage } from "@/marketing/pages/ContactPage";
import { FeaturePage as MarketingFeaturePage } from "@/marketing/pages/FeaturePage";
import { FeaturesIndexPage } from "@/marketing/pages/FeaturesIndexPage";
import { HomePage as MarketingHomePage } from "@/marketing/pages/HomePage";
import { IndustryPage as MarketingIndustryPage } from "@/marketing/pages/IndustryPage";
import { IndustriesIndexPage } from "@/marketing/pages/IndustriesIndexPage";
import { NotFoundPage } from "@/marketing/pages/NotFoundPage";
import { ProductOverviewPage } from "@/marketing/pages/ProductOverviewPage";
import { WhyMaterialOSPage } from "@/marketing/pages/WhyMaterialOSPage";
import { ApprovalsPage } from "@/routes/ApprovalsPage";
import { BooksPage } from "@/routes/BooksPage";
import { BranchesPage } from "@/routes/BranchesPage";
import { WarehousesPage } from "@/routes/inventory/WarehousesPage";
import { BatchesPage } from "@/routes/inventory/BatchesPage";
import { StockMovementsPage } from "@/routes/inventory/StockMovementsPage";
import { CollectionsPage } from "@/routes/CollectionsPage";
import { CompanySettingsPage } from "@/routes/CompanySettingsPage";
import { CreditDebitNotesPage } from "@/routes/CreditDebitNotesPage";
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
import { LeadsPage } from "@/routes/LeadsPage";
import { ImpersonationEntryPage } from "@/routes/ImpersonationEntryPage";
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
import { GuardianPortalLoginPage } from "@/routes/guardianPortal/GuardianPortalLoginPage";
import { GuardianPortalDashboardPage } from "@/routes/guardianPortal/GuardianPortalDashboardPage";
import { GuardianPortalChildPage } from "@/routes/guardianPortal/GuardianPortalChildPage";
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
import { SupportTicketDetailPage } from "@/routes/support/SupportTicketDetailPage";
import { SupportTicketsPage } from "@/routes/support/SupportTicketsPage";
import { ReportsPage } from "@/routes/ReportsPage";
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
import { SalesOrdersPage } from "@/routes/SalesOrdersPage";
import { AcademicYearsPage } from "@/routes/education/AcademicYearsPage";
import { ClassesPage } from "@/routes/education/ClassesPage";
import { StudentsPage } from "@/routes/education/StudentsPage";
import { StudentDetailPage } from "@/routes/education/StudentDetailPage";
import { StudentAttendancePage } from "@/routes/education/StudentAttendancePage";
import { TimetablePage } from "@/routes/education/TimetablePage";
import { ExaminationsPage } from "@/routes/education/ExaminationsPage";
import { ExaminationDetailPage } from "@/routes/education/ExaminationDetailPage";
import { HomeworkPage } from "@/routes/education/HomeworkPage";
import { HomeworkDetailPage } from "@/routes/education/HomeworkDetailPage";
import { FeesPage } from "@/routes/education/FeesPage";
import { AdmissionEnquiriesPage } from "@/routes/admissions/AdmissionEnquiriesPage";
import { AdmissionApplicationsPage } from "@/routes/admissions/AdmissionApplicationsPage";
import { AdmissionApplicationDetailPage } from "@/routes/admissions/AdmissionApplicationDetailPage";
import { SerialRmaPage } from "@/routes/SerialRmaPage";
import { ServerSettingsPage } from "@/routes/ServerSettingsPage";
import { IndustryConfigPage } from "@/routes/settings/IndustryConfigPage";
import { SignupPage } from "@/routes/SignupPage";
import { SubscriptionInvoicesPage } from "@/routes/settings/SubscriptionInvoicesPage";
import { SubscriptionPage } from "@/routes/settings/SubscriptionPage";
import { CapabilityMarketplacePage } from "@/routes/settings/CapabilityMarketplacePage";
import { LabSampleDetailPage } from "@/routes/laboratory/LabSampleDetailPage";
import { LabInstrumentsPage } from "@/routes/laboratory/LabInstrumentsPage";
import { LabQcPage } from "@/routes/laboratory/LabQcPage";
import { LabSamplesPage } from "@/routes/laboratory/LabSamplesPage";
import { LabSpecificationsPage } from "@/routes/laboratory/LabSpecificationsPage";
import { LabStorageLocationsPage } from "@/routes/laboratory/LabStorageLocationsPage";
import { LabTestCatalogPage } from "@/routes/laboratory/LabTestCatalogPage";
import { LabWorksheetDetailPage } from "@/routes/laboratory/LabWorksheetDetailPage";
import { LabWorksheetsPage } from "@/routes/laboratory/LabWorksheetsPage";
import { MetalRatesPage } from "@/routes/settings/MetalRatesPage";
import { ReceiptSettingsPage } from "@/routes/settings/ReceiptSettingsPage";
import { WebhooksPage } from "@/routes/settings/WebhooksPage";
import { SubscriptionPaymentsPage } from "@/routes/settings/SubscriptionPaymentsPage";
import { UsersPage } from "@/routes/UsersPage";
import { useAuthStore } from "@/store/auth";
import { usePlatformAuthStore } from "@/store/platformAuth";

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

function RequireGuardianPortalAuth({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const guardianId = useAuthStore((s) => s.guardianId);
  if (!accessToken || !guardianId) return <Navigate to="/guardian-portal/login" replace />;
  return <>{children}</>;
}

function RequirePlatformAuth({ children }: { children: React.ReactNode }) {
  const accessToken = usePlatformAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/platform/login" replace />;
  return <>{children}</>;
}

/** "/" is shared between the public marketing homepage and the
 * authenticated Dashboard -- a logged-in visitor sees exactly what
 * they see today (Dashboard, unchanged); a logged-out visitor sees the
 * marketing homepage instead of being redirected to /login. */
function RootRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) {
    return (
      <AppShell>
        <DashboardPage />
      </AppShell>
    );
  }
  return (
    <MarketingLayout>
      <MarketingHomePage />
    </MarketingLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/impersonate" element={<ImpersonationEntryPage />} />
      <Route path="/server-settings" element={<ServerSettingsPage />} />
      <Route path="/pricing" element={<MarketingLayout><PricingPage /></MarketingLayout>} />
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/guardian-portal/login" element={<GuardianPortalLoginPage />} />

      <Route path="/" element={<RootRoute />} />
      <Route path="/industries" element={<MarketingLayout><IndustriesIndexPage /></MarketingLayout>} />
      <Route path="/industries/:slug" element={<MarketingLayout><MarketingIndustryPage /></MarketingLayout>} />
      <Route path="/features" element={<MarketingLayout><FeaturesIndexPage /></MarketingLayout>} />
      <Route path="/features/:slug" element={<MarketingLayout><MarketingFeaturePage /></MarketingLayout>} />
      <Route path="/why-materialos" element={<MarketingLayout><WhyMaterialOSPage /></MarketingLayout>} />
      <Route path="/compare" element={<MarketingLayout><ComparePage /></MarketingLayout>} />
      <Route path="/product" element={<MarketingLayout><ProductOverviewPage /></MarketingLayout>} />
      <Route path="/about" element={<MarketingLayout><MarketingAboutPage /></MarketingLayout>} />
      <Route path="/contact" element={<MarketingLayout><MarketingContactPage /></MarketingLayout>} />
      <Route path="/book-demo" element={<MarketingLayout><BookDemoPage /></MarketingLayout>} />

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

      <Route
        element={
          <RequireGuardianPortalAuth>
            <GuardianPortalShell />
          </RequireGuardianPortalAuth>
        }
      >
        <Route path="/guardian-portal" element={<GuardianPortalDashboardPage />} />
        <Route path="/guardian-portal/children/:studentId" element={<GuardianPortalChildPage />} />
      </Route>

      {/* Platform admin console (ADR-020): MaterialOS-the-company operating
          MaterialOS-the-product -- its own auth store/token type, no
          AppShell/PortalShell, never mixed with a tenant or portal login. */}
      <Route path="/platform/login" element={<PlatformLoginPage />} />
      <Route
        element={
          <RequirePlatformAuth>
            <PlatformLayout />
          </RequirePlatformAuth>
        }
      >
        <Route path="/platform/tenants" element={<PlatformTenantsPage />} />
        <Route path="/platform/tenants/:tenantId" element={<PlatformTenantDetailPage />} />
        <Route path="/platform/tenants/:tenantId/audit-logs" element={<PlatformTenantAuditLogPage />} />
        <Route path="/platform/plans" element={<PlatformPlansPage />} />
        <Route path="/platform/admins" element={<PlatformAdminsPage />} />
        <Route path="/platform/support-tickets" element={<PlatformSupportTicketsPage />} />
        <Route path="/platform/support-tickets/:ticketId" element={<PlatformSupportTicketDetailPage />} />
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
        <Route path="/production-board" element={<RequireModule module="printing"><ProductionBoardPage /></RequireModule>} />
        <Route path="/print-jobs" element={<RequireModule module="printing"><PrintJobsPage /></RequireModule>} />
        <Route path="/print-jobs/:jobId" element={<RequireModule module="printing"><PrintJobDetailPage /></RequireModule>} />
        <Route path="/print-machines" element={<RequireModule module="printing"><PrintMachinesPage /></RequireModule>} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:customerId" element={<Customer360Page />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/quotations" element={<QuotationsPage />} />
        <Route path="/quotations/new" element={<NewQuotationPage />} />
        <Route path="/quotations/:quotationId" element={<QuotationDetailPage />} />
        <Route path="/support" element={<SupportTicketsPage />} />
        <Route path="/support/:ticketId" element={<SupportTicketDetailPage />} />
        <Route path="/sales-orders" element={<SalesOrdersPage />} />
        <Route path="/students" element={<RequireModule module="education"><StudentsPage /></RequireModule>} />
        <Route path="/students/:studentId" element={<RequireModule module="education"><StudentDetailPage /></RequireModule>} />
        <Route path="/classes" element={<RequireModule module="education"><ClassesPage /></RequireModule>} />
        <Route path="/student-attendance" element={<RequireModule module="education"><StudentAttendancePage /></RequireModule>} />
        <Route path="/timetable" element={<RequireModule module="education"><TimetablePage /></RequireModule>} />
        <Route path="/examinations" element={<RequireModule module="education"><ExaminationsPage /></RequireModule>} />
        <Route path="/examinations/:examinationId" element={<RequireModule module="education"><ExaminationDetailPage /></RequireModule>} />
        <Route path="/homework" element={<RequireModule module="education"><HomeworkPage /></RequireModule>} />
        <Route path="/homework/:homeworkId" element={<RequireModule module="education"><HomeworkDetailPage /></RequireModule>} />
        <Route path="/fees" element={<RequireModule module="education"><FeesPage /></RequireModule>} />
        <Route path="/academic-years" element={<RequireModule module="education"><AcademicYearsPage /></RequireModule>} />
        <Route path="/admission-enquiries" element={<RequireModule module="education"><AdmissionEnquiriesPage /></RequireModule>} />
        <Route path="/admission-applications" element={<RequireModule module="education"><AdmissionApplicationsPage /></RequireModule>} />
        <Route path="/admission-applications/:applicationId" element={<RequireModule module="education"><AdmissionApplicationDetailPage /></RequireModule>} />
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
        <Route path="/serial-rma" element={<SerialRmaPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/field-sales" element={<FieldSalesPage />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/imports/new" element={<ImportWizardPage />} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/warehouses" element={<RequireModule module="warehouse"><WarehousesPage /></RequireModule>} />
        <Route path="/batches" element={<RequireModule module="warehouse"><BatchesPage /></RequireModule>} />
        <Route path="/stock-ledger" element={<RequireModule module="warehouse"><StockMovementsPage /></RequireModule>} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/books" element={<BooksPage />} />
        <Route path="/gst" element={<GstPage />} />
        <Route path="/credit-debit-notes" element={<CreditDebitNotesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
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
        <Route path="/settings/capabilities" element={<CapabilityMarketplacePage />} />
        <Route path="/settings/subscription/invoices" element={<SubscriptionInvoicesPage />} />
        <Route path="/settings/subscription/payments" element={<SubscriptionPaymentsPage />} />
        <Route path="/settings/receipts" element={<ReceiptSettingsPage />} />
        <Route path="/settings/metal-rates" element={<MetalRatesPage />} />
        <Route path="/lab/samples" element={<RequireModule module="laboratory"><LabSamplesPage /></RequireModule>} />
        <Route path="/lab/samples/:sampleId" element={<RequireModule module="laboratory"><LabSampleDetailPage /></RequireModule>} />
        <Route path="/lab/test-catalog" element={<RequireModule module="laboratory"><LabTestCatalogPage /></RequireModule>} />
        <Route path="/lab/specifications" element={<RequireModule module="laboratory"><LabSpecificationsPage /></RequireModule>} />
        <Route path="/lab/qc" element={<RequireModule module="laboratory"><LabQcPage /></RequireModule>} />
        <Route path="/lab/worksheets" element={<RequireModule module="laboratory"><LabWorksheetsPage /></RequireModule>} />
        <Route path="/lab/worksheets/:worksheetId" element={<RequireModule module="laboratory"><LabWorksheetDetailPage /></RequireModule>} />
        <Route path="/lab/instruments" element={<RequireModule module="laboratory"><LabInstrumentsPage /></RequireModule>} />
        <Route path="/lab/storage" element={<RequireModule module="laboratory"><LabStorageLocationsPage /></RequireModule>} />
        <Route path="/settings/webhooks" element={<WebhooksPage />} />
      </Route>

      <Route path="*" element={<MarketingLayout><NotFoundPage /></MarketingLayout>} />
    </Routes>
  );
}
