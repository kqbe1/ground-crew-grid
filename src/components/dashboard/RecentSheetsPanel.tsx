import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { INTERVENTION_TYPE_LABELS } from "@/lib/constants";

interface RecentSheet {
  id: string;
  created_at: string;
  final_status: string;
  client_absent: boolean;
  is_draft: boolean;
  work_tasks: { title: string; intervention_type: string; clients: { name: string } | null } | null;
  profiles: { full_name: string } | null;
}

export default function RecentSheetsPanel() {
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<RecentSheet[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("intervention_sheets")
        .select("id, created_at, final_status, client_absent, is_draft, work_tasks(title, intervention_type, clients(name)), profiles:worker_id(full_name)")
        .eq("is_draft", false)
        .order("created_at", { ascending: false })
        .limit(5);
      setSheets((data as any) ?? []);
    };
    fetch();

    // Realtime subscription for new sheets
    const channel = supabase
      .channel("dashboard-sheets")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "intervention_sheets" }, () => {
        fetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const isNew = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    return diff < 24 * 60 * 60 * 1000; // less than 24h
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/fiches")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[hsl(var(--color-termine))]" />
            Fiches récentes
            {sheets.some((s) => isNew(s.created_at)) && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--color-termine))] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[hsl(var(--color-termine))]" />
              </span>
            )}
          </CardTitle>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sheets.length === 0 && <p className="text-sm text-muted-foreground">Aucune fiche récente</p>}
        {sheets.map((s) => {
          const fresh = isNew(s.created_at);
          return (
            <div
              key={s.id}
              className={`flex items-center justify-between text-sm py-1.5 border-b last:border-0 rounded-sm transition-colors ${fresh ? "bg-emerald-50 dark:bg-emerald-950/20 px-1.5 -mx-1.5" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate flex items-center gap-1.5">
                  {fresh && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                  {s.work_tasks?.title || "Fiche"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.profiles?.full_name} · {formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: fr })}
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                {s.client_absent && (
                  <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-600">Absent</Badge>
                )}
                <Badge className="text-[9px] bg-emerald-600 text-white">
                  {INTERVENTION_TYPE_LABELS[s.work_tasks?.intervention_type || ""]?.split(" ").pop() || "Terminé"}
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
