import { Outlet, Navigate, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Building2,
  Users,
  LogOut,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Settings,
  ScrollText,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { to: "/super-admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/super-admin/companies", icon: Building2, label: "Entreprises" },
  { to: "/super-admin/users", icon: Users, label: "Utilisateurs" },
  { to: "/super-admin/settings", icon: Settings, label: "Paramètres" },
  { to: "/super-admin/logs", icon: ScrollText, label: "Journal" },
];

export default function SuperAdminLayout() {
  const { session, loading, role, profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (role !== "super_admin") return <Navigate to="/" replace />;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className={cn("flex items-center gap-3 px-4 h-16 border-b border-sidebar-border", collapsed && "justify-center")}>
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <h1 className="text-sm font-bold truncate">PME Terrain</h1>
          )}
        </div>

        {!collapsed && (
          <div className="px-4 py-2 border-b border-sidebar-border">
            <Badge className="text-[10px] gap-1 bg-amber-600 text-white">
              <ShieldCheck className="w-3 h-3" />
              Super Admin
            </Badge>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center py-2 border-b border-sidebar-border" title="Super Admin">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/super-admin"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-amber-600 text-white"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full transition-colors"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!collapsed && <span>Réduire</span>}
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-destructive/20 hover:text-destructive w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
