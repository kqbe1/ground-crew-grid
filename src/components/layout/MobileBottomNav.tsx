import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Calendar,
  ListTodo,
  FileText,
  MoreHorizontal,
  Users,
  Wrench,
  Package,
  ClipboardList,
  Clock,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const primaryNav = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["admin", "bureau", "super_admin"] },
  { to: "/planning", icon: Calendar, label: "Planning", roles: ["admin", "bureau", "super_admin"] },
  { to: "/taches", icon: ListTodo, label: "Tâches", roles: ["admin", "bureau", "super_admin"] },
  { to: "/devis", icon: FileText, label: "Devis", roles: ["admin", "bureau", "super_admin"] },
];

const secondaryNav = [
  { to: "/clients", icon: Users, label: "Clients", roles: ["admin", "bureau", "super_admin"] },
  { to: "/entretiens", icon: Wrench, label: "Entretiens", roles: ["admin", "bureau", "super_admin"] },
  { to: "/commandes", icon: Package, label: "Commandes", roles: ["admin", "bureau", "super_admin"] },
  { to: "/fiches", icon: ClipboardList, label: "Fiches", roles: ["admin", "bureau", "super_admin"] },
  { to: "/temps-ouvriers", icon: Clock, label: "Temps", roles: ["admin", "bureau", "super_admin"] },
  { to: "/admin", icon: Settings, label: "Admin", roles: ["admin", "bureau", "super_admin"] },
];

export default function MobileBottomNav() {
  const { role } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const filteredPrimary = primaryNav.filter((item) => role && item.roles.includes(role));
  const filteredSecondary = secondaryNav.filter((item) => role && item.roles.includes(role));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around py-2 z-50">
        {filteredPrimary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
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
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 pt-4">
            {filteredSecondary.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-lg text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                  )
                }
              >
                <item.icon className="w-6 h-6" />
                <span className="text-xs">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
