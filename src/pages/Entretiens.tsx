import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { INTERVENTION_TYPE_LABELS, PERIODICITY_LABELS } from "@/lib/constants";
import { Wrench, Calendar, TrendingUp } from "lucide-react";

export default function Entretiens() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("maintenance_schedules")
        .select("*, clients(name), client_sites(address), client_equipment(name, brand, model)")
        .order("next_due_date");
      setSchedules(data ?? []);

      // Compute stats by type
      const byType: Record<string, number> = {};
      (data ?? []).forEach((s: any) => {
        byType[s.intervention_type] = (byType[s.intervention_type] || 0) + 1;
      });
      setStats(byType);
    };
    fetch();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Entretiens</h1>
        <p className="text-muted-foreground">Planification et suivi des entretiens récurrents</p>
      </div>

      {/* Stats by type */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(stats).map(([type, count]) => (
          <Card key={type} className="flex-1 min-w-[140px]">
            <CardContent className="py-3 text-center">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-muted-foreground">{INTERVENTION_TYPE_LABELS[type] || type}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {schedules.map((s) => (
          <Card key={s.id} className="animate-slide-in">
            <CardContent className="py-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wrench className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{s.clients?.name}</div>
                <div className="text-sm text-muted-foreground truncate">
                  {s.client_sites?.address} · {s.client_equipment?.brand} {s.client_equipment?.model}
                </div>
              </div>
              <Badge variant="outline">{INTERVENTION_TYPE_LABELS[s.intervention_type]}</Badge>
              <Badge variant="outline">{PERIODICITY_LABELS[s.periodicity]}</Badge>
              <div className="text-sm text-right">
                <div className="font-medium">
                  {s.next_due_date ? format(new Date(s.next_due_date), "d MMM yyyy", { locale: fr }) : "—"}
                </div>
                <div className="text-xs text-muted-foreground">Prochaine</div>
              </div>
            </CardContent>
          </Card>
        ))}
        {schedules.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            Aucun entretien planifié
          </div>
        )}
      </div>
    </div>
  );
}
