import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSearch } from "@/lib/searchUtils";
import { format, getYear, getMonth, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { INTERVENTION_TYPE_LABELS, PERIODICITY_LABELS } from "@/lib/constants";
import { Wrench, Calendar, TrendingUp, Plus, AlertTriangle, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import CreateEditEntretienDialog from "@/components/entretiens/CreateEditEntretienDialog";
import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"maintenance_schedules">;

const PERIODICITY_MONTHS: Record<string, number> = {
  mensuel: 1, trimestriel: 3, semestriel: 6, annuel: 12, bisannuel: 24, triennal: 36,
};

const ENTRETIEN_TYPES = Object.entries(INTERVENTION_TYPE_LABELS).filter(([k]) => k.startsWith("entretien_"));

export default function Entretiens() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchSchedules = useCallback(async () => {
    const { data } = await supabase
      .from("maintenance_schedules")
      .select("*, clients(name), client_sites(address), client_equipment(name, brand, model)")
      .order("next_due_date");
    setSchedules(data ?? []);
  }, []);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  // Filtered list
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (filterType !== "all" && s.intervention_type !== filterType) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (search) {
        const q = normalizeSearch(search);
        const name = normalizeSearch(s.clients?.name);
        const addr = normalizeSearch(s.client_sites?.address);
        const equip = normalizeSearch(`${s.client_equipment?.brand || ""} ${s.client_equipment?.model || ""}`);
        if (!name.includes(q) && !addr.includes(q) && !equip.includes(q)) return false;
      }
      return true;
    });
  }, [schedules, search, filterType, filterStatus]);

  const currentYear = getYear(new Date());

  // Stats by type (all schedules, active only)
  const statsByType = useMemo(() => {
    const byType: Record<string, number> = {};
    schedules.forEach((s) => {
      if (s.status !== "actif") return;
      byType[s.intervention_type] = (byType[s.intervention_type] || 0) + 1;
    });
    return byType;
  }, [schedules]);

  // Total annual count current year
  const annualTotal = useMemo(() => {
    let count = 0;
    schedules.forEach((s) => {
      if (s.status !== "actif" || !s.next_due_date) return;
      const periodMonths = PERIODICITY_MONTHS[s.periodicity] || 12;
      let nextDate = new Date(s.next_due_date);
      // Walk backwards to find if there's an occurrence this year
      while (getYear(nextDate) > currentYear) {
        nextDate.setMonth(nextDate.getMonth() - periodMonths);
      }
      // Walk forward
      while (getYear(nextDate) < currentYear) {
        nextDate.setMonth(nextDate.getMonth() + periodMonths);
      }
      // Count occurrences in current year
      while (getYear(nextDate) === currentYear) {
        count++;
        nextDate = new Date(nextDate);
        nextDate.setMonth(nextDate.getMonth() + periodMonths);
      }
    });
    return count;
  }, [schedules, currentYear]);

  // Stats by month (current year) with type breakdown
  const monthlyStats = useMemo(() => {
    const months: Record<number, Record<string, number>> = {};
    for (let i = 0; i < 12; i++) months[i] = {};

    schedules.forEach((s) => {
      if (s.status !== "actif" || !s.next_due_date) return;
      const periodMonths = PERIODICITY_MONTHS[s.periodicity] || 12;
      let nextDate = new Date(s.next_due_date);

      // Walk to the right range
      while (getYear(nextDate) > currentYear) nextDate.setMonth(nextDate.getMonth() - periodMonths);
      while (getYear(nextDate) < currentYear) nextDate.setMonth(nextDate.getMonth() + periodMonths);

      while (getYear(nextDate) === currentYear) {
        const m = getMonth(nextDate);
        months[m][s.intervention_type] = (months[m][s.intervention_type] || 0) + 1;
        nextDate = new Date(nextDate);
        nextDate.setMonth(nextDate.getMonth() + periodMonths);
      }
    });
    return months;
  }, [schedules, currentYear]);

  const monthTotals = useMemo(() => {
    return Object.entries(monthlyStats).map(([, byType]) =>
      Object.values(byType).reduce((a, b) => a + b, 0)
    );
  }, [monthlyStats]);

  // Projections N, N+1, N+2, N+3
  const projections = useMemo(() => {
    const years = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3];
    const result = years.map((y) => ({ year: y, byType: {} as Record<string, number>, total: 0 }));

    schedules.forEach((s) => {
      if (s.status !== "actif" || !s.next_due_date) return;
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

  // Color for type badges in monthly view
  const typeColors: Record<string, string> = {
    entretien_gaz: "bg-blue-500",
    entretien_mazout: "bg-amber-600",
    entretien_pellets: "bg-green-600",
    entretien_clim: "bg-cyan-500",
    entretien_vmc: "bg-purple-500",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nouvel entretien
        </Button>
      </div>

      {/* Stats cards by type */}
      <div className="flex flex-wrap gap-3">
        {ENTRETIEN_TYPES.map(([type, label]) => (
          <Card key={type} className="flex-1 min-w-[130px]">
            <CardContent className="py-3 text-center">
              <div className="text-2xl font-bold text-primary">{statsByType[type] || 0}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
        <Card className="flex-1 min-w-[130px] border-primary/30 bg-primary/5">
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-primary">
              {Object.values(statsByType).reduce((a, b) => a + b, 0)}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Total actifs</div>
          </CardContent>
        </Card>
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
                <div key={s.id} className="text-sm text-amber-700 cursor-pointer hover:underline" onClick={() => navigate(`/entretiens/${s.id}`)}>
                  {s.clients?.name} — {INTERVENTION_TYPE_LABELS[s.intervention_type]} — Échéance : {format(new Date(s.next_due_date), "dd/MM/yyyy")}
                </div>
              ))}
              {legalAlerts.length > 5 && (
                <div className="text-xs text-amber-600">+{legalAlerts.length - 5} autre(s)…</div>
              )}
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
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher client, adresse, équipement…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-1" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {ENTRETIEN_TYPES.map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="actif">Actif</SelectItem>
                <SelectItem value="suspendu">Suspendu</SelectItem>
                <SelectItem value="termine">Terminé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {filteredSchedules.map((s) => (
              <Card
                key={s.id}
                className={cn("animate-slide-in cursor-pointer hover:shadow-md transition-shadow", getDueUrgency(s.next_due_date))}
                onClick={() => navigate(`/entretiens/${s.id}`)}
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
                  {s.status !== "actif" && (
                    <Badge variant="secondary">{s.status}</Badge>
                  )}
                  <div className="text-sm text-right">
                    <div className="font-medium">
                      {s.next_due_date ? format(new Date(s.next_due_date), "d MMM yyyy", { locale: fr }) : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">Prochaine</div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredSchedules.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                {schedules.length === 0 ? "Aucun entretien planifié" : "Aucun résultat pour ces filtres"}
              </div>
            )}
          </div>
        </TabsContent>

        {/* MONTHLY TAB */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Répartition mensuelle — {currentYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Monthly grid */}
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 mb-6">
                {monthTotals.map((count, i) => (
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

              {/* Breakdown by type per month */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Type</th>
                      {monthNames.map((m) => (
                        <th key={m} className="text-center py-2 px-1 font-medium text-muted-foreground min-w-[40px]">{m}</th>
                      ))}
                      <th className="text-center py-2 px-2 font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENTRETIEN_TYPES.map(([type, label]) => {
                      const yearTotal = Object.values(monthlyStats).reduce(
                        (sum, byType) => sum + (byType[type] || 0), 0
                      );
                      if (yearTotal === 0) return null;
                      return (
                        <tr key={type} className="border-b border-muted/50">
                          <td className="py-2 pr-4 flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", typeColors[type] || "bg-muted-foreground")} />
                            <span className="text-xs">{label}</span>
                          </td>
                          {Array.from({ length: 12 }, (_, i) => (
                            <td key={i} className="text-center py-2 px-1">
                              {monthlyStats[i]?.[type] ? (
                                <span className="font-medium">{monthlyStats[i][type]}</span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                          ))}
                          <td className="text-center py-2 px-2 font-bold">{yearTotal}</td>
                        </tr>
                      );
                    })}
                    <tr className="font-bold">
                      <td className="py-2 pr-4 text-xs">Total</td>
                      {monthTotals.map((count, i) => (
                        <td key={i} className="text-center py-2 px-1">{count || "—"}</td>
                      ))}
                      <td className="text-center py-2 px-2 text-primary">
                        {monthTotals.reduce((a, b) => a + b, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROJECTIONS TAB */}
        <TabsContent value="projections">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {projections.map((proj, idx) => (
              <Card key={proj.year} className={cn(idx === 0 && "border-primary/30 bg-primary/5")}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    {proj.year}
                    {idx === 0 && <Badge variant="outline" className="text-[10px]">En cours</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary mb-3">{proj.total}</div>
                  <div className="space-y-1.5">
                    {ENTRETIEN_TYPES.map(([type, label]) => {
                      const count = proj.byType[type] || 0;
                      if (count === 0) return null;
                      return (
                        <div key={type} className="flex justify-between text-sm items-center">
                          <span className="flex items-center gap-1.5">
                            <span className={cn("w-2 h-2 rounded-full", typeColors[type] || "bg-muted-foreground")} />
                            <span className="text-muted-foreground">{label}</span>
                          </span>
                          <span className="font-medium">{count}</span>
                        </div>
                      );
                    })}
                    {/* Non-entretien types */}
                    {Object.entries(proj.byType)
                      .filter(([type]) => !type.startsWith("entretien_"))
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <div key={type} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{INTERVENTION_TYPE_LABELS[type] || type}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    {Object.keys(proj.byType).length === 0 && (
                      <p className="text-sm text-muted-foreground">Aucune projection</p>
                    )}
                  </div>

                  {/* Comparison with previous year */}
                  {idx > 0 && projections[idx - 1].total > 0 && (
                    <div className="mt-3 pt-2 border-t text-xs text-muted-foreground">
                      {proj.total > projections[idx - 1].total
                        ? `+${proj.total - projections[idx - 1].total} vs ${projections[idx - 1].year}`
                        : proj.total < projections[idx - 1].total
                        ? `${proj.total - projections[idx - 1].total} vs ${projections[idx - 1].year}`
                        : `= vs ${projections[idx - 1].year}`}
                    </div>
                  )}
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
    </div>
  );
}