import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface LateTask {
  id: string;
  title: string;
  start_time: string | null;
  scheduled_date: string;
  clientName?: string | null;
}

export default function FichesEnRetardPanel({ tasks }: { tasks: LateTask[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (tasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1 flex items-center justify-center">
              {tasks.length}
            </span>
          </div>
          <span className="text-sm font-semibold text-destructive">Fiches à envoyer</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <div className={cn("transition-all", open ? "max-h-[60vh] overflow-y-auto" : "max-h-0 overflow-hidden")}>
        <div className="px-3 pb-3 space-y-2">
          {tasks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/mobile/tache/${t.id}`)}
              className="w-full text-left bg-background rounded-lg p-2.5 border border-border active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-destructive capitalize">
                  {format(new Date(t.scheduled_date), "d MMM", { locale: fr })}
                </span>
                <span className="text-xs text-muted-foreground">{t.start_time?.slice(0, 5) ?? "—"}</span>
                <span className="text-xs font-medium truncate flex-1">{t.title}</span>
              </div>
              {t.clientName && <div className="text-[11px] text-muted-foreground truncate">{t.clientName}</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
