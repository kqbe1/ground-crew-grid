import { Outlet, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, ClipboardList, Package, User, WifiOff, RefreshCw, FileText, AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOfflineDrafts } from "@/hooks/useOfflineDrafts";
import { toast } from "sonner";
import MobileTaskNotifications from "@/components/mobile/MobileTaskNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import OfflineSyncSheet from "@/components/mobile/OfflineSyncSheet";
import { useState } from "react";

const baseMobileNav = [
  { to: "/mobile", icon: Calendar, label: "Agenda" },
  { to: "/mobile/fiches", icon: ClipboardList, label: "Fiches" },
  { to: "/mobile/pieces", icon: Package, label: "Pièces" },
];

export default function MobileLayout() {
  const { session, loading, role, profile } = useAuth();
  usePushNotifications();
  const { isOnline, pendingCount, syncing, syncAll, drafts, statusMap, retryDraft, discardDraft } = useOfflineDrafts();
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);

  const errorCount = drafts.filter((d) => !d.synced && statusMap[d.id]?.state === "error").length;

  const showDevis = role === "admin" || (role === "ouvrier" && profile?.can_create_devis);
  
  const mobileNav = [
    ...baseMobileNav,
    ...(showDevis ? [{ to: "/mobile/devis/nouveau", icon: FileText, label: "Devis" }] : []),
    { to: "/mobile/profil", icon: User, label: "Profil" },
  ];

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
        <button
          onClick={() => setSyncSheetOpen(true)}
          className={cn(
            "flex items-center justify-between px-4 py-2 text-xs font-medium w-full text-left transition-opacity active:opacity-70",
            errorCount > 0
              ? "bg-destructive/15 text-destructive"
              : !isOnline
              ? "bg-[hsl(var(--color-replanifier))]/15 text-[hsl(var(--color-replanifier))]"
              : "bg-[hsl(var(--color-commandee))]/15 text-[hsl(var(--color-commandee))]"
          )}
        >
          <div className="flex items-center gap-1.5">
            {errorCount > 0 ? (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errorCount} fiche(s) en erreur · toucher pour voir</span>
              </>
            ) : !isOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Hors ligne{pendingCount > 0 ? ` · ${pendingCount} fiche(s) en attente` : ""}</span>
              </>
            ) : (
              <>
                <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
                <span>{syncing ? "Synchronisation…" : `${pendingCount} fiche(s) en attente`}</span>
              </>
            )}
          </div>
          <ChevronRight className="w-3.5 h-3.5 opacity-70" />
        </button>
      )}

      <OfflineSyncSheet
        open={syncSheetOpen}
        onOpenChange={setSyncSheetOpen}
        drafts={drafts}
        statusMap={statusMap}
        isOnline={isOnline}
        syncing={syncing}
        onSyncAll={handleManualSync}
        onRetry={retryDraft}
        onDiscard={discardDraft}
      />

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
            {item.to === "/mobile/fiches" && pendingCount > 0 && (
              <span className={cn(
                "absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-[9px] flex items-center justify-center font-bold",
                errorCount > 0
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "bg-[hsl(var(--color-commandee))] text-white"
              )}>
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
