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
  Shield,
  ShieldCheck,
  Building2,
  FileText,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["admin", "bureau"] },
  { to: "/planning", icon: Calendar, label: "Planning", roles: ["admin", "bureau"] },
  { to: "/clients", icon: Users, label: "Clients", roles: ["admin", "bureau"] },
  { to: "/entretiens", icon: WrenchIcon, label: "Entretiens", roles: ["admin", "bureau"] },
  { to: "/commandes", icon: Package, label: "Commandes", roles: ["admin", "bureau"] },
  { to: "/taches", icon: ListTodo, label: "Tâches", roles: ["admin", "bureau"] },
  { to: "/devis", icon: FileText, label: "Devis", roles: ["admin", "bureau"] },
  { to: "/fiches", icon: ClipboardList, label: "Fiches", roles: ["admin", "bureau"] },
  { to: "/dossiers", icon: FolderOpen, label: "Dossiers", roles: ["admin", "bureau"] },
  { to: "/temps-ouvriers", icon: Clock, label: "Temps", roles: ["admin", "bureau"] },
  { to: "/admin", icon: Settings, label: "Admin", roles: ["admin", "bureau"] },
];

const roleConfig: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  super_admin: { label: "Super Admin", color: "badge-role-super_admin", icon: ShieldCheck },
  admin: { label: "Admin", color: "badge-role-admin", icon: Shield },
  bureau: { label: "Bureau", color: "badge-role-bureau", icon: Building2 },
};

export default function AppSidebar() {
  const { role, profile, company, signOut } = useAuth();
  const location = useLocation();

  const filteredItems = navItems.filter((item) => role && item.roles.includes(role));
  const currentRoleConfig = role ? roleConfig[role] : null;

  const showCompanyLogo = role !== "super_admin" && company;
  const companyLabel = company?.display_name || company?.name || "PME Terrain";

  return (
    <aside
      className="flex h-screen w-64 min-w-64 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        {showCompanyLogo && company.logo_url ? (
          <>
            <img
              src={company.logo_url}
              alt={companyLabel}
              className="h-8 w-8 flex-shrink-0 object-contain"
            />
            <h1 className="truncate text-sm font-bold">{companyLabel}</h1>
          </>
        ) : (
          <>
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <WrenchIcon className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <h1 className="truncate text-sm font-bold">{showCompanyLogo ? companyLabel : "PME Terrain"}</h1>
          </>
        )}
      </div>

      {/* Role badge */}
      {currentRoleConfig && (
        <div className="px-4 py-2 border-b border-sidebar-border">
          <Badge className={cn("text-[10px] gap-1", currentRoleConfig.color)}>
            <currentRoleConfig.icon className="w-3 h-3" />
            {currentRoleConfig.label}
          </Badge>
        </div>
      )}

      {/* SuperAdmin link */}
      {role === "super_admin" && (
        <div className="px-2 pt-4 pb-1">
          <NavLink
            to="/super-admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-[hsl(var(--color-role-super-admin))]/10 text-[hsl(var(--color-role-super-admin))] hover:bg-[hsl(var(--color-role-super-admin))]/20 transition-colors"
          >
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <span>Console SuperAdmin</span>
          </NavLink>
        </div>
      )}

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
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-destructive/20 hover:text-destructive w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
