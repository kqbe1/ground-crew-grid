import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2, WifiOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OfflineDraft, DraftStatus } from "@/hooks/useOfflineDrafts";

interface OfflineSyncSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: OfflineDraft[];
  statusMap: Record<string, DraftStatus>;
  isOnline: boolean;
  syncing: boolean;
  onSyncAll: () => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}

const STATE_LABEL: Record<DraftStatus["state"], string> = {
  pending: "En attente",
  syncing: "Envoi en cours…",
  synced: "Envoyée ✓",
  error: "Échec",
};

function StatusIcon({ state }: { state: DraftStatus["state"] }) {
  switch (state) {
    case "syncing":
      return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    case "synced":
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    case "error":
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OfflineSyncSheet({
  open,
  onOpenChange,
  drafts,
  statusMap,
  isOnline,
  syncing,
  onSyncAll,
  onRetry,
  onDiscard,
}: OfflineSyncSheetProps) {
  const pending = drafts.filter((d) => !d.synced);
  const hasErrors = pending.some((d) => statusMap[d.id]?.state === "error");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <RefreshCw className={cn("w-5 h-5", syncing && "animate-spin")} />
            Synchronisation hors-ligne
          </SheetTitle>
          <SheetDescription>
            {pending.length === 0
              ? "Aucun brouillon en attente. Tout est à jour."
              : `${pending.length} fiche(s) à synchroniser${hasErrors ? " — certaines en erreur" : ""}.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 mt-2 mb-3">
          <Badge variant={isOnline ? "default" : "destructive"} className="gap-1">
            {isOnline ? <RefreshCw className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isOnline ? "En ligne" : "Hors ligne"}
          </Badge>
          <Button
            size="sm"
            onClick={onSyncAll}
            disabled={!isOnline || syncing || pending.length === 0}
            className="ml-auto"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Synchronisation
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-1" /> Tout synchroniser
              </>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {pending.length === 0 && (
            <div className="text-center text-muted-foreground py-12 text-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-600" />
              Aucun envoi en attente
            </div>
          )}
          {pending.map((d) => {
            const status = statusMap[d.id] ?? { state: "pending" as const, updated_at: d.created_at };
            const title =
              (d.payload as any)?.intervention_type ||
              (d.payload as any)?.entretien_type ||
              "Fiche";
            return (
              <div
                key={d.id}
                className={cn(
                  "rounded-lg border p-3 bg-card",
                  status.state === "error" && "border-destructive/40 bg-destructive/5",
                  status.state === "syncing" && "border-primary/40 bg-primary/5",
                )}
              >
                <div className="flex items-start gap-2">
                  <StatusIcon state={status.state} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{title}</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTime(d.created_at)}
                      </span>
                    </div>
                    <p className={cn(
                      "text-xs mt-0.5",
                      status.state === "error" ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {STATE_LABEL[status.state]}
                      {status.error ? ` — ${status.error}` : ""}
                    </p>
                    {status.state === "error" && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRetry(d.id)}
                          disabled={!isOnline}
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Réessayer
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Supprimer définitivement ce brouillon ?")) onDiscard(d.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}