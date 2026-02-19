import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format, addYears, getYear, getMonth, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { INTERVENTION_TYPE_LABELS, PERIODICITY_LABELS } from "@/lib/constants";
import { Wrench, Calendar, TrendingUp, Plus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import CreateEditEntretienDialog from "@/components/entretiens/CreateEditEntretienDialog";
import EntretienDetailDialog from "@/components/entretiens/EntretienDetailDialog";
import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"maintenance_schedules">;

const PERIODICITY_MONTHS: Record<string, number> = {
  mensuel: 1, trimestriel: 3, semestriel: 6, annuel: 12, bisannuel: 24, triennal: 36,
};

export default function Entretiens() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [detailSchedule, setDetailSchedule] = useState<any>(null);

  const fetchSchedules = useCallback(async () => {
    const { data } = await supabase
      .from("maintenance_schedules")
      .select("*, clients(name), client_sites(address), client_equipment(name, brand, model)")
      .order("next_due_date");
    setSchedules(data ?? []);
  }, []);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  // Stats by type
  const statsByType = useMemo(() => {
    const byType: Record<string, number> = {};
    schedules.forEach((s) => { byType[s.intervention_type] = (byType[s.intervention_type] || 0) + 1; });
    return byType;
  }, [schedules]);

  // Stats by month (current year)
  const currentYear = getYear(new Date());
  const statsByMonth = useMemo(() => {
    const months = Array(12).fill(0);
    schedules.forEach((s) => {
      if (!s.next_due_date) return;
      const d = new Date(s.next_due_date);
      if (getYear(d) === currentYear) months[getMonth(d)]++;
    });
    return months;
  }, [schedules, currentYear]);

  // Projections N+1, N+2, N+3
  const projections = useMemo(() => {
    const result = [
      { year: currentYear + 1, byType: {} as Record<string, number>, total: 0 },
      { year: currentYear + 2, byType: {} as Record<string, number>, total: 0 },
      { year: currentYear + 3, byType: {} as Record<string, number>, total: 0 },
    ];

    schedules.forEach((s) => {
      if (s.status !== "actif" || !s.next_due_date) return;
      const periodMonths = PERIODICITY_MONTHS[s.periodicity] || 12;
      let nextDate = new Date(s.next_due_date);

      // Generate occurrences for the next 3 years
      for (let i = 0; i < 100; i++) {
        const yr = getYear(nextDate);
        if (yr > currentYear + 3) break;
        const proj = result.find((p) => p.year === yr);
        if (proj) {
          proj.byType[s.intervention_type] = (proj.byType[s.intervention_type] || 0) + 1;
          proj.total++;
        }
        nextDate = new Date(nextDate);
        nextDate.setMonth(nextDate.getMonth() + periodMonths);
      }
    });

    return result;
  }, [schedules, currentYear]);

  // Legal alerts
  const legalAlerts = useMemo(() => {
    return schedules.filter((s) => {
      if (!s.legal_alert_years || !s.next_due_date) return false;
      const days = differenceInDays(new Date(s.next_due_date), new Date());
      return days < 0 || days <= 90;
    });
  }, [schedules]);

  const getDueUrgency = (nextDate: string | null) => {
    if (!nextDate) return "";
    const days = differenceInDays(new Date(nextDate), new Date());
    if (days < 0) return "border-l-4 border-l-destructive";
    if (days <= 30) return "border-l-4 border-l-orange-400";
    return "";
  };

  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entretiens</h1>
          <p className="text-muted-foreground">{schedules.length} entretien(s) planifié(s)</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nouvel entretien
        </Button>
      </div>

      {/* Stats by type */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(statsByType).map(([type, count]) => (
          <Card key={type} className="flex-1 min-w-[130px]">
            <CardContent className="py-3 text-center">
              <div className="text-2xl font-bold text-primary">{count}</div>
              <div className="text-xs text-muted-foreground">{INTERVENTION_TYPE_LABELS[type] || type}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Legal alerts */}
      {legalAlerts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 font-medium text-amber-800 mb-2">
              <AlertTriangle className="w-4 h-4" /> Alertes légales ({legalAlerts.length})
            </div>
            <div className="space-y-1">
              {legalAlerts.slice(0, 5).map((s) => (
                <div key={s.id} className="text-sm text-amber-700 cursor-pointer hover:underline" onClick={() => setDetailSchedule(s)}>
                  {s.clients?.name} — {INTERVENTION_TYPE_LABELS[s.intervention_type]} — Échéance : {format(new Date(s.next_due_date), "dd/MM/yyyy")}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Liste</TabsTrigger>
          <TabsTrigger value="monthly">Mensuel {currentYear}</TabsTrigger>
          <TabsTrigger value="projections">Projections</TabsTrigger>
        </TabsList>

        {/* LIST TAB */}
        <TabsContent value="list">
          <div className="space-y-2">
            {schedules.map((s) => (
              <Card
                key={s.id}
                className={cn("animate-slide-in cursor-pointer hover:shadow-md transition-shadow", getDueUrgency(s.next_due_date))}
                onClick={() => setDetailSchedule(s)}
              >
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
              <div className="py-12 text-center text-muted-foreground">Aucun entretien planifié</div>
            )}
          </div>
        </TabsContent>

        {/* MONTHLY TAB */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" /> Répartition mensuelle — {currentYear}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                {statsByMonth.map((count, i) => (
                  <div key={i} className="text-center">
                    <div className={cn(
                      "text-xl font-bold rounded-lg py-2",
                      count > 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    )}>
                      {count}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{monthNames[i]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-muted-foreground text-right">
                Total {currentYear} : <span className="font-bold text-foreground">{statsByMonth.reduce((a, b) => a + b, 0)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROJECTIONS TAB */}
        <TabsContent value="projections">
          <div className="grid gap-4 md:grid-cols-3">
            {projections.map((proj) => (
              <Card key={proj.year}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> {proj.year}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary mb-3">{proj.total}</div>
                  <div className="space-y-1">
                    {Object.entries(proj.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{INTERVENTION_TYPE_LABELS[type] || type}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                    {Object.keys(proj.byType).length === 0 && (
                      <p className="text-sm text-muted-foreground">Aucune projection</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateEditEntretienDialog
        open={createOpen || !!editSchedule}
        onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditSchedule(null); } }}
        schedule={editSchedule}
        onSaved={fetchSchedules}
      />
      <EntretienDetailDialog
        open={!!detailSchedule}
        onOpenChange={(o) => { if (!o) setDetailSchedule(null); }}
        schedule={detailSchedule}
        onEdit={() => { setEditSchedule(detailSchedule); setDetailSchedule(null); }}
      />
    </div>
  );
}
