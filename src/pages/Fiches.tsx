import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import { ClipboardList, FileSignature, Camera, Check } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function Fiches() {
  const [sheets, setSheets] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("intervention_sheets")
        .select("*, work_tasks(title, clients(name)), profiles!intervention_sheets_worker_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      setSheets(data ?? []);
    };
    fetch();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Fiches d'intervention</h1>
        <p className="text-muted-foreground">{sheets.length} fiche(s)</p>
      </div>

      <div className="space-y-2">
        {sheets.map((sheet) => (
          <Card key={sheet.id} className="animate-slide-in hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="py-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardList className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{sheet.work_tasks?.title}</div>
                <div className="text-sm text-muted-foreground">
                  {sheet.work_tasks?.clients?.name} · {sheet.profiles?.full_name}
                </div>
              </div>
              <div className="flex gap-1.5">
                {sheet.signature_data && (
                  <div className="p-1 rounded bg-status-termine/10" title="Signé">
                    <FileSignature className="w-3.5 h-3.5 text-status-termine" />
                  </div>
                )}
                {(sheet.photos_before?.length > 0 || sheet.photos_after?.length > 0) && (
                  <div className="p-1 rounded bg-primary/10" title="Photos">
                    <Camera className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                {sheet.is_draft && <Badge variant="outline">Brouillon</Badge>}
              </div>
              <Badge variant="outline">{TASK_STATUS_LABELS[sheet.final_status]}</Badge>
              <div className="text-xs text-muted-foreground">
                {format(new Date(sheet.created_at), "d MMM yyyy", { locale: fr })}
              </div>
            </CardContent>
          </Card>
        ))}
        {sheets.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            Aucune fiche d'intervention
          </div>
        )}
      </div>
    </div>
  );
}
