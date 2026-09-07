import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { BranchesPage } from "@/routes/BranchesPage";
import { DashboardPage } from "@/routes/DashboardPage";
import { ImportWizardPage } from "@/routes/imports/ImportWizardPage";
import { ImportsPage } from "@/routes/imports/ImportsPage";
import { LoginPage } from "@/routes/LoginPage";
import { SignupPage } from "@/routes/SignupPage";
import { UsersPage } from "@/routes/UsersPage";
import { useAuthStore } from "@/store/auth";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/imports/new" element={<ImportWizardPage />} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/users" element={<UsersPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
