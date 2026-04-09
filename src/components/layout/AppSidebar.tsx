import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Wrench as WrenchIcon,
  Clock,
  Package,
  ListTodo,
  ClipboardList,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["admin", "bureau", "secretariat", "super_admin"] },
  { to: "/planning", icon: Calendar, label: "Planning", roles: ["admin", "bureau", "secretariat", "super_admin"] },
  { to: "/clients", icon: Users, label: "Clients", roles: ["admin", "bureau", "secretariat", "super_admin"] },
  { to: "/entretiens", icon: WrenchIcon, label: "Entretiens", roles: ["admin", "bureau", "secretariat", "super_admin"] },
  { to: "/commandes", icon: Package, label: "Commandes", roles: ["admin", "bureau", "secretariat", "super_admin"] },
  { to: "/taches", icon: ListTodo, label: "Tâches", roles: ["admin", "bureau", "secretariat", "super_admin"] },
  { to: "/fiches", icon: ClipboardList, label: "Fiches", roles: ["admin", "bureau", "secretariat", "super_admin"] },
  { to: "/temps-ouvriers", icon: Clock, label: "Temps", roles: ["admin", "bureau", "super_admin"] },
  { to: "/admin", icon: Settings, label: "Admin", roles: ["admin", "bureau", "super_admin"] },
];

const roleConfig: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  super_admin: { label: "Super Admin", color: "bg-amber-600 text-white", icon: ShieldCheck },
  admin: { label: "Admin", color: "bg-destructive text-destructive-foreground", icon: Shield },
  bureau: { label: "Bureau", color: "bg-blue-600 text-white", icon: Building2 },
  secretariat: { label: "Secrétariat", color: "bg-secondary text-secondary-foreground", icon: ClipboardList },
};

export default function AppSidebar() {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const filteredItems = navItems.filter((item) => role && item.roles.includes(role));

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <WrenchIcon className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold truncate">PME Terrain</h1>
            <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.full_name}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {filteredItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
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
  );
}
