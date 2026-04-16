import { Outlet, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, ClipboardList, Package, User, WifiOff, RefreshCw, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOfflineDrafts } from "@/hooks/useOfflineDrafts";
import { toast } from "sonner";
import MobileTaskNotifications from "@/components/mobile/MobileTaskNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const baseMobileNav = [
  { to: "/mobile", icon: Calendar, label: "Agenda" },
  { to: "/mobile/fiches", icon: ClipboardList, label: "Fiches" },
  { to: "/mobile/pieces", icon: Package, label: "Pièces" },
];

export default function MobileLayout() {
  const { session, loading } = useAuth();
  usePushNotifications();
  const { isOnline, pendingCount, syncing, syncAll } = useOfflineDrafts();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  const handleManualSync = async () => {
    if (!isOnline) {
      toast.error("Pas de connexion réseau");
      return;
    }
    const count = await syncAll();
    if (count && count > 0) {
      toast.success(`${count} fiche(s) synchronisée(s)`);
    } else {
      toast.info("Rien à synchroniser");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <MobileTaskNotifications />
      {(!isOnline || pendingCount > 0) && (
        <div
          className={cn(
            "flex items-center justify-between px-4 py-2 text-xs font-medium",
            !isOnline
              ? "bg-[hsl(var(--color-replanifier))]/15 text-[hsl(var(--color-replanifier))]"
              : "bg-[hsl(var(--color-commandee))]/15 text-[hsl(var(--color-commandee))]"
          )}
        >
          <div className="flex items-center gap-1.5">
            {!isOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Hors ligne{pendingCount > 0 ? ` · ${pendingCount} fiche(s) en attente` : ""}</span>
              </>
            ) : (
              <>
                <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
                <span>{syncing ? "Synchronisation..." : `${pendingCount} fiche(s) en attente`}</span>
              </>
            )}
          </div>
          {isOnline && pendingCount > 0 && !syncing && (
            <button onClick={handleManualSync} className="underline text-xs font-semibold">
              Synchroniser
            </button>
          )}
        </div>
      )}

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
                "flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium transition-colors relative",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
            {/* Pending dot on Fiches tab */}
            {item.to === "/mobile/fiches" && pendingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[hsl(var(--color-replanifier))] rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
