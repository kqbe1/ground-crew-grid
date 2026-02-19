import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function MobileFiches() {
  const { user } = useAuth();
  const [sheets, setSheets] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("intervention_sheets")
        .select("*, work_tasks(title, clients(name))")
        .eq("worker_id", user.id)
        .order("created_at", { ascending: false });
      setSheets(data ?? []);
    };
    fetch();
  }, [user]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Mes fiches</h1>
      <div className="space-y-2">
        {sheets.map((s) => (
          <Card key={s.id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.work_tasks?.title}</div>
                  <div className="text-sm text-muted-foreground">{s.work_tasks?.clients?.name}</div>
                </div>
                <div className="text-right">
                  <Badge variant={s.is_draft ? "outline" : "default"}>
                    {s.is_draft ? "Brouillon" : TASK_STATUS_LABELS[s.final_status]}
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(s.created_at), "d MMM", { locale: fr })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {sheets.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">Aucune fiche</div>
        )}
      </div>
    </div>
  );
}
