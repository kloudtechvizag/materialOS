import { Link, Outlet, useNavigate } from "react-router-dom";

import { usePlatformAuthStore } from "@/store/platformAuth";

/** No sidebar, no AppShell -- this is a small internal tool, not a
 * tenant workspace (spec sec56: don't mix authenticated ERP UI with
 * this). Just enough chrome to know where you are and sign out. */
export function PlatformLayout() {
  const navigate = useNavigate();
  const clearToken = usePlatformAuthStore((s) => s.clearToken);

  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <header className="flex h-14 items-center justify-between border-b border-white/10 px-6">
        <div className="flex items-center gap-6">
          <Link to="/platform/tenants" className="text-sm font-semibold tracking-wide">
            MaterialOS Platform
          </Link>
          <nav className="flex items-center gap-4 text-sm text-white/60">
            <Link to="/platform/tenants" className="hover:text-white">Tenants</Link>
            <Link to="/platform/plans" className="hover:text-white">Plans</Link>
            <Link to="/platform/support-tickets" className="hover:text-white">Support</Link>
            <Link to="/platform/admins" className="hover:text-white">Admins</Link>
          </nav>
        </div>
        <button
          type="button"
          onClick={() => {
            clearToken();
            navigate("/platform/login");
          }}
          className="text-sm text-white/60 hover:text-white"
        >
          Sign out
        </button>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
