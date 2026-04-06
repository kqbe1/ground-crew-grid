import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { INTERVENTION_TYPE_LABELS } from "@/lib/constants";
import { BarChart3, TrendingUp, Users, Wrench, ClipboardList, Calendar } from "lucide-react";
import { getYear, getMonth, format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const PERIODICITY_MONTHS: Record<string, number> = {
  mensuel: 1, trimestriel: 3, semestriel: 6, annuel: 12, bisannuel: 24, triennal: 36,
};

const ENTRETIEN_TYPES = Object.entries(INTERVENTION_TYPE_LABELS).filter(([k]) => k.startsWith("entretien_"));

const typeColors: Record<string, string> = {
  entretien_gaz: "bg-blue-500",
  entretien_mazout: "bg-amber-600",
  entretien_pellets: "bg-green-600",
  entretien_clim: "bg-cyan-500",
  entretien_vmc: "bg-purple-500",
};

export default function AdminStatsTab() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [sheets, setSheets] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [schedRes, taskRes, sheetRes, workerRes] = await Promise.all([
        supabase.from("maintenance_schedules").select("*").eq("status", "actif"),
        supabase.from("work_tasks").select("id, status, intervention_type, scheduled_date, assigned_to, duration_minutes"),
        supabase.from("intervention_sheets").select("id, created_at, worker_id, is_draft").eq("is_draft", false),
        supabase.from("profiles").select("id, full_name, is_active, worker_level").eq("is_active", true),
      ]);
      setSchedules(schedRes.data ?? []);
      setTasks(taskRes.data ?? []);
      setSheets(sheetRes.data ?? []);
      setWorkers(workerRes.data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  const currentYear = getYear(new Date());

  // --- Projections entretiens ---
  const projections = useMemo(() => {
    const years = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3];
    const result = years.map((y) => ({ year: y, byType: {} as Record<string, number>, total: 0 }));

    schedules.forEach((s) => {
      if (!s.next_due_date) return;
      const periodMonths = PERIODICITY_MONTHS[s.periodicity] || 12;
      let nextDate = new Date(s.next_due_date);
      for (let i = 0; i < 200; i++) {
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

  // --- Tasks stats ---
  const taskStats = useMemo(() => {
    const thisYear = tasks.filter((t) => t.scheduled_date && getYear(new Date(t.scheduled_date)) === currentYear);
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    thisYear.forEach((t) => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byType[t.intervention_type] = (byType[t.intervention_type] || 0) + 1;
    });
    return { total: thisYear.length, byStatus, byType };
  }, [tasks, currentYear]);

  // --- Monthly activity (last 6 months) ---
  const monthlyActivity = useMemo(() => {
    const months: { label: string; tasks: number; sheets: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const label = format(d, "MMM yy", { locale: fr });
      const taskCount = tasks.filter((t) => {
        const sd = new Date(t.scheduled_date);
        return sd >= start && sd <= end;
      }).length;
      const sheetCount = sheets.filter((s) => {
        const sd = new Date(s.created_at);
        return sd >= start && sd <= end;
      }).length;
      months.push({ label, tasks: taskCount, sheets: sheetCount });
    }
    return months;
  }, [tasks, sheets]);

  // --- Worker productivity ---
  const workerStats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    return workers
      .filter((w) => {
        // Only workers (check if they have tasks assigned)
        return tasks.some((t) => t.assigned_to === w.id);
      })
      .map((w) => {
        const workerTasks = tasks.filter((t) => t.assigned_to === w.id && t.scheduled_date && getYear(new Date(t.scheduled_date)) === currentYear);
        const workerSheets = sheets.filter((s) => s.worker_id === w.id);
        const monthTasks = workerTasks.filter((t) => new Date(t.scheduled_date) >= monthStart);
        const totalHours = workerTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0) / 60;
        return {
          ...w,
          totalTasks: workerTasks.length,
          totalSheets: workerSheets.length,
          monthTasks: monthTasks.length,
          totalHours: Math.round(totalHours),
        };
      })
      .sort((a, b) => b.totalTasks - a.totalTasks);
  }, [workers, tasks, sheets, currentYear]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    planifie: "Planifié",
    termine: "Terminé",
    a_replanifier: "À replanifier",
    piece_a_commander: "Pièce à commander",
  };

  const statusColors: Record<string, string> = {
    planifie: "bg-primary/15 text-primary",
    termine: "bg-green-100 text-green-800",
    a_replanifier: "bg-orange-100 text-orange-800",
    piece_a_commander: "bg-amber-100 text-amber-800",
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Wrench className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{schedules.length}</div>
            <div className="text-xs text-muted-foreground">Entretiens actifs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{taskStats.total}</div>
            <div className="text-xs text-muted-foreground">Tâches {currentYear}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <ClipboardList className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{sheets.length}</div>
            <div className="text-xs text-muted-foreground">Fiches complétées</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{workers.filter((w) => w.worker_level).length}</div>
            <div className="text-xs text-muted-foreground">Ouvriers actifs</div>
          </CardContent>
        </Card>
      </div>

      {/* Projections entretiens */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Projections d'entretiens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {projections.map((proj, idx) => (
              <div
                key={proj.year}
                className={cn(
                  "rounded-xl p-4 border",
                  idx === 0 ? "border-primary/30 bg-primary/5" : "bg-muted/30"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">{proj.year}</span>
                  {idx === 0 && <Badge variant="outline" className="text-[9px] py-0">En cours</Badge>}
                </div>
                <div className="text-3xl font-bold text-primary mb-3">{proj.total}</div>
                <div className="space-y-1">
                  {ENTRETIEN_TYPES.map(([type, label]) => {
                    const count = proj.byType[type] || 0;
                    if (count === 0) return null;
                    return (
                      <div key={type} className="flex justify-between text-xs items-center">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("w-2 h-2 rounded-full", typeColors[type] || "bg-muted-foreground")} />
                          <span className="text-muted-foreground">{label}</span>
                        </span>
                        <span className="font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
                {idx > 0 && projections[idx - 1].total > 0 && (
                  <div className="mt-2 pt-1.5 border-t text-[10px] text-muted-foreground">
                    {proj.total > projections[idx - 1].total
                      ? `+${proj.total - projections[idx - 1].total} vs ${projections[idx - 1].year}`
                      : proj.total < projections[idx - 1].total
                      ? `${proj.total - projections[idx - 1].total} vs ${projections[idx - 1].year}`
                      : `= vs ${projections[idx - 1].year}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Tasks by status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Tâches {currentYear} par statut
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(taskStats.byStatus)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => {
                  const pct = taskStats.total ? Math.round((count / taskStats.total) * 100) : 0;
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={cn("px-2 py-0.5 rounded text-xs font-medium", statusColors[status] || "bg-muted")}>
                          {statusLabels[status] || status}
                        </span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              {Object.keys(taskStats.byStatus).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune tâche cette année</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Monthly activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Activité mensuelle (6 mois)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {monthlyActivity.map((m) => {
                const max = Math.max(...monthlyActivity.map((x) => x.tasks), 1);
                const pct = Math.round((m.tasks / max) * 100);
                return (
                  <div key={m.label} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 text-right capitalize">{m.label}</span>
                    <div className="flex-1 h-5 rounded bg-muted overflow-hidden relative">
                      <div className="h-full rounded bg-primary/50 transition-all" style={{ width: `${pct}%` }} />
                      <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium">
                        {m.tasks} tâche{m.tasks !== 1 ? "s" : ""} · {m.sheets} fiche{m.sheets !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Worker productivity */}
      {workerStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Charge par ouvrier — {currentYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Ouvrier</th>
                    <th className="text-center py-2 font-medium">Niveau</th>
                    <th className="text-center py-2 font-medium">Tâches {currentYear}</th>
                    <th className="text-center py-2 font-medium">Ce mois</th>
                    <th className="text-center py-2 font-medium">Heures est.</th>
                    <th className="text-center py-2 font-medium">Fiches</th>
                  </tr>
                </thead>
                <tbody>
                  {workerStats.map((w) => (
                    <tr key={w.id} className="border-b border-muted/50">
                      <td className="py-2 font-medium">{w.full_name}</td>
                      <td className="py-2 text-center">
                        {w.worker_level ? (
                          <Badge variant="outline" className="text-[10px]">{w.worker_level}</Badge>
                        ) : "—"}
                      </td>
                      <td className="py-2 text-center font-medium">{w.totalTasks}</td>
                      <td className="py-2 text-center">{w.monthTasks}</td>
                      <td className="py-2 text-center text-muted-foreground">{w.totalHours}h</td>
                      <td className="py-2 text-center">{w.totalSheets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}