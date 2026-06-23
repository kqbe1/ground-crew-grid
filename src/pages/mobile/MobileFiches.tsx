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

export default function MobileFiches() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [sheetsRes, clientsRes] = await Promise.all([
        supabase
          .from("intervention_sheets")
          .select("*, work_tasks(title, client_id, intervention_type)")
          .eq("worker_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_my_clients_safe"),
      ]);
      const clientMap = Object.fromEntries(
        (clientsRes.data ?? []).map((c: any) => [c.id, c])
      );
      const enriched = (sheetsRes.data ?? []).map((s: any) => ({
        ...s,
        work_tasks: s.work_tasks
          ? { ...s.work_tasks, clients: s.work_tasks.client_id ? clientMap[s.work_tasks.client_id] ?? null : null }
          : null,
      }));
      setSheets(enriched);
    };
    fetch();
  }, [user]);

  const handleOpen = (s: any) => {
    const status = computeSheetStatus(s);
    if (status === "draft" && s.work_task_id) {
      // Reprendre l'édition du brouillon
      navigate(`/mobile/fiche/${s.work_task_id}`);
    } else {
      // Lecture seule
      navigate(`/fiches/${s.id}`);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Mes fiches</h1>
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
        {sheets.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">Aucune fiche</div>
        )}
      </div>
    </div>
  );
}
