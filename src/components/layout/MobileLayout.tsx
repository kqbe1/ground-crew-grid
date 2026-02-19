import { Outlet, Navigate, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, ClipboardList, Package, User } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileNav = [
  { to: "/mobile", icon: Calendar, label: "Agenda" },
  { to: "/mobile/fiches", icon: ClipboardList, label: "Fiches" },
  { to: "/mobile/pieces", icon: Package, label: "Pièces" },
  { to: "/mobile/profil", icon: User, label: "Profil" },
];

export default function MobileLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return (
    <div className="flex flex-col h-screen bg-background">
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around py-2 z-50">
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/mobile"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
