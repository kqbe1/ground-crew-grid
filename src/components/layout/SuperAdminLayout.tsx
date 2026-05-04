import { Outlet, Navigate, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Building2,
  Users,
  LogOut,
  ShieldCheck,
  Settings,
  ScrollText,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const navItems = [
  { to: "/super-admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/super-admin/companies", icon: Building2, label: "Entreprises" },
  { to: "/super-admin/users", icon: Users, label: "Utilisateurs" },
  { to: "/super-admin/settings", icon: Settings, label: "Paramètres" },
  { to: "/super-admin/logs", icon: ScrollText, label: "Journal" },
];

export default function SuperAdminLayout() {
  const { session, loading, role, profile, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [moreOpen, setMoreOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (role !== "super_admin") return <Navigate to="/" replace />;

  if (isMobile) {
    const primaryItems = navItems.slice(0, 3);
    const secondaryItems = navItems.slice(3);

    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-16">
          <Outlet />
        </main>
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around py-2 z-50">
          {primaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/super-admin"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium transition-colors",
                  isActive ? "text-[hsl(var(--color-role-super-admin))]" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>Plus</span>
          </button>
        </nav>
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="pb-8">
            <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
            <div className="grid grid-cols-3 gap-3 pt-4">
              {secondaryItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg text-sm font-medium transition-colors",
                      isActive ? "bg-[hsl(var(--color-role-super-admin))]/10 text-[hsl(var(--color-role-super-admin))]" : "text-muted-foreground hover:bg-accent"
                    )
                  }
                >
                  <item.icon className="w-6 h-6" />
                  <span className="text-xs">{item.label}</span>
                </NavLink>
              ))}
              <button
                onClick={() => { setMoreOpen(false); signOut(); }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-6 h-6" />
                <span className="text-xs">Déconnexion</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className="flex h-screen w-64 min-w-64 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[hsl(var(--color-role-super-admin))] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <h1 className="truncate text-sm font-bold">PME Terrain</h1>
        </div>

        <div className="px-4 py-2 border-b border-sidebar-border">
          <Badge className="text-[10px] gap-1 bg-[hsl(var(--color-role-super-admin))] text-white">
            <ShieldCheck className="w-3 h-3" /> Super Admin
          </Badge>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/super-admin"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "bg-[hsl(var(--color-role-super-admin))] text-white" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
          <button onClick={signOut} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-destructive/20 hover:text-destructive w-full transition-colors">
            <LogOut className="w-5 h-5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
