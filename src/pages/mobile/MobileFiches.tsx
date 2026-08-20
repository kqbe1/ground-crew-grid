import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  SheetStatusBadge,
  computeSheetStatus,
  sheetStatusBorderClass,
} from "@/components/shared/SheetStatusBadge";
import { listLocalFicheDrafts, removeLocalFicheDraft, type LocalFicheDraft } from "@/lib/localFicheDrafts";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DraftItem extends LocalFicheDraft {
  title?: string | null;
  clientName?: string | null;
  interventionType?: string | null;
}

export default function MobileFiches() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const local = listLocalFicheDrafts();
      const [sheetsRes, clientsRes, tasksRes] = await Promise.all([
        supabase
          .from("intervention_sheets")
          .select("*, work_tasks(title, client_id, intervention_type)")
          .eq("worker_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_my_clients_safe"),
        local.length
          ? supabase
              .from("work_tasks")
              .select("id, title, client_id, intervention_type")
              .in("id", local.map((d) => d.taskId))
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const clientMap = Object.fromEntries(
        (clientsRes.data ?? []).map((c: any) => [c.id, c])
      );
      const sheetRows = sheetsRes.data ?? [];
      const enriched = sheetRows.map((s: any) => ({
        ...s,
        work_tasks: s.work_tasks
          ? { ...s.work_tasks, clients: s.work_tasks.client_id ? clientMap[s.work_tasks.client_id] ?? null : null }
          : null,
      }));
      setSheets(enriched);

      // Tâches dont la fiche est déjà envoyée : on masque le brouillon local
      const submittedTaskIds = new Set(
        sheetRows.filter((s: any) => s.is_draft === false).map((s: any) => s.work_task_id),
      );
      const taskMap = Object.fromEntries(((tasksRes as any).data ?? []).map((t: any) => [t.id, t]));
      setDrafts(
        local
          .filter((d) => !submittedTaskIds.has(d.taskId) && taskMap[d.taskId])
          .map((d) => ({
            ...d,
            title: taskMap[d.taskId]?.title,
            interventionType: taskMap[d.taskId]?.intervention_type,
            clientName: clientMap[taskMap[d.taskId]?.client_id]?.name ?? null,
          })),
      );
    };
    fetch();
  }, [user]);

  const handleOpen = (s: any) => {
    const status = computeSheetStatus(s);
    if (status === "draft" && s.work_task_id) {
      navigate(`/mobile/fiche/${s.work_task_id}`);
    } else {
      navigate(`/mobile/fiches/${s.id}`);
    }
  };

  const handleDeleteDraft = (d: DraftItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer définitivement ce brouillon ?")) return;
    removeLocalFicheDraft(d.key);
    setDrafts((prev) => prev.filter((x) => x.key !== d.key));
    toast.success("Brouillon supprimé");
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mes fiches</h1>
        <Button size="sm" onClick={() => navigate("/mobile/fiche/nouvelle")}>
          <Plus className="w-4 h-4 mr-1" /> Nouvelle fiche
        </Button>
      </div>

      {drafts.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Brouillons en cours ({drafts.length})
          </div>
          {drafts.map((d) => (
            <Card
              key={d.key}
              className={cn(
                "cursor-pointer active:scale-[0.98] transition-transform",
                sheetStatusBorderClass("draft"),
              )}
              onClick={() => navigate(`/mobile/fiche/${d.taskId}`)}
            >
              <CardContent className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.title}</div>
                    <div className="text-sm text-muted-foreground truncate">{d.clientName}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <SheetStatusBadge status="draft" />
                    <div className="text-[10px] text-muted-foreground">
                      {d.savedAt ? format(new Date(d.savedAt), "d MMM HH:mm", { locale: fr }) : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {d.interventionType && (
                      <Badge className={cn("text-[10px]", INTERVENTION_TYPE_COLORS[d.interventionType])}>
                        {INTERVENTION_TYPE_LABELS[d.interventionType]}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Étape {d.step}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteDraft(d, e)}
                    className="p-1.5 rounded-full text-destructive hover:bg-destructive/10"
                    aria-label="Supprimer le brouillon"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {sheets.map((s) => {
          const status = computeSheetStatus(s);
          const intType = s.work_tasks?.intervention_type;
          return (
            <Card
              key={s.id}
              className={cn(
                "cursor-pointer active:scale-[0.98] transition-transform",
                sheetStatusBorderClass(status),
              )}
              onClick={() => handleOpen(s)}
            >
              <CardContent className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.work_tasks?.title}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {s.work_tasks?.clients?.name}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <SheetStatusBadge status={status} />
                    <div className="text-[10px] text-muted-foreground">
                      {format(new Date(s.created_at), "d MMM", { locale: fr })}
                    </div>
                  </div>
                </div>
                {intType && (
                  <Badge className={cn("text-[10px]", INTERVENTION_TYPE_COLORS[intType])}>
                    {INTERVENTION_TYPE_LABELS[intType]}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
        {sheets.length === 0 && drafts.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">Aucune fiche</div>
        )}
      </div>
    </div>
  );
}
