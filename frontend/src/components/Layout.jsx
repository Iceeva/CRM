/**
 * components/Layout.jsx - Layout principal avec sidebar + header
 */
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import useStorageStatus from "../hooks/useStorageStatus";

const navItems = [
  { to: "/", label: "Tableau de bord", icon: "📊" },
  { to: "/clients", label: "Clients", icon: "👥" },
  { to: "/prospects", label: "Prospects", icon: "🎯" },
  { to: "/opportunities", label: "Opportunités", icon: "💰" },
  { to: "/interactions", label: "Interactions", icon: "💬" },
];

export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const storageMode = useStorageStatus(30000);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-primary-700 tracking-tight">🏢 CRM Pro</h1>
          <p className="text-xs text-gray-400 mt-1">Gestion Relation Client</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary-50 text-primary-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Mode stockage */}
        <div className="p-4 border-t border-gray-100">
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
              storageMode === "postgresql"
                ? "bg-green-50 text-green-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            <span>{storageMode === "postgresql" ? "🐘" : "📄"}</span>
            {storageMode === "postgresql" ? "PostgreSQL" : "JSON (local)"}
          </div>
        </div>

        {/* Profil */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
              {(user?.nom || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{user?.nom}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Déconnexion"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full bg-white shadow-xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h1 className="text-xl font-bold text-primary-700">🏢 CRM Pro</h1>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <nav className="p-4 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-gray-600 hover:bg-gray-50"
                    }`
                  }
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ☰
          </button>
          <h1 className="text-lg font-bold text-primary-700">🏢 CRM Pro</h1>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-500">🚪</button>
        </header>

        {/* Page */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
