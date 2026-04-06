import { useEffect, useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INTERVENTION_TYPE_LABELS } from "@/lib/constants";
import { Clock, Users, Calendar, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";

interface SheetRow {
  id: string;
  arrival_time: string | null;
  departure_time: string | null;
  worker_id: string;
  work_task_id: string;
  created_at: string;
  worker: { full_name: string } | null;
  task: {
    title: string;
    intervention_type: string;
    scheduled_date: string;
    client: { name: string } | null;
  } | null;
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export default function TempsOuvriers() {
  const { role } = useAuth();
  const [sheets, setSheets] = useState<SheetRow[]>([]);
  const [workers, setWorkers] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedWorker, setSelectedWorker] = useState("all");
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [sheetsRes, workersRes] = await Promise.all([
        supabase
          .from("intervention_sheets")
          .select("id, arrival_time, departure_time, worker_id, work_task_id, created_at, is_draft")
          .eq("is_draft", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("is_active", true),
      ]);

      const rawSheets = sheetsRes.data ?? [];
      setWorkers(workersRes.data ?? []);

      // Fetch related task + client data
      const taskIds = [...new Set(rawSheets.map((s) => s.work_task_id))];
      const workerIds = [...new Set(rawSheets.map((s) => s.worker_id))];

      const [tasksRes, profilesRes] = await Promise.all([
        taskIds.length > 0
          ? supabase
              .from("work_tasks")
              .select("id, title, intervention_type, scheduled_date, client_id, clients(name)")
              .in("id", taskIds)
          : Promise.resolve({ data: [] }),
        workerIds.length > 0
          ? supabase.from("profiles").select("id, full_name").in("id", workerIds)
          : Promise.resolve({ data: [] }),
      ]);

      const taskMap = new Map((tasksRes.data ?? []).map((t: any) => [t.id, t]));
      const workerMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));

      const enriched: SheetRow[] = rawSheets.map((s) => {
        const task = taskMap.get(s.work_task_id);
        const worker = workerMap.get(s.worker_id);
        return {
          ...s,
          worker: worker ? { full_name: worker.full_name } : null,
          task: task
            ? {
                title: task.title,
                intervention_type: task.intervention_type,
                scheduled_date: task.scheduled_date,
                client: task.clients ? { name: (task.clients as any).name } : null,
              }
            : null,
        };
      });

      setSheets(enriched);
      setLoading(false);
    };

    fetchData();
  }, []);

  const now = new Date();
  const periodRange = useMemo(() => {
    if (period === "week") {
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }, [period]);

  const filteredSheets = useMemo(() => {
    return sheets.filter((s) => {
      if (selectedWorker !== "all" && s.worker_id !== selectedWorker) return false;
      if (!s.arrival_time || !s.departure_time) return false;
      const date = parseISO(s.task?.scheduled_date || s.created_at);
      return date >= periodRange.start && date <= periodRange.end;
    });
  }, [sheets, selectedWorker, periodRange]);

  const totalMinutes = useMemo(() => {
    return filteredSheets.reduce((acc, s) => {
      if (!s.arrival_time || !s.departure_time) return acc;
      return acc + Math.max(0, differenceInMinutes(new Date(s.departure_time), new Date(s.arrival_time)));
    }, 0);
  }, [filteredSheets]);

  const workerSummary = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; tasks: number }>();
    filteredSheets.forEach((s) => {
      if (!s.arrival_time || !s.departure_time) return;
      const mins = Math.max(0, differenceInMinutes(new Date(s.departure_time), new Date(s.arrival_time)));
      const existing = map.get(s.worker_id) || { name: s.worker?.full_name || "Inconnu", minutes: 0, tasks: 0 };
      existing.minutes += mins;
      existing.tasks += 1;
      map.set(s.worker_id, existing);
    });
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filteredSheets]);

  const avgPerTask = filteredSheets.length > 0 ? Math.round(totalMinutes / filteredSheets.length) : 0;

  if (role && role !== "admin" && role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Temps de travail</h1>
        <p className="text-muted-foreground">Suivi du temps de travail des ouvriers</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Cette semaine</SelectItem>
            <SelectItem value="month">Ce mois</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedWorker} onValueChange={setSelectedWorker}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tous les ouvriers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les ouvriers</SelectItem>
            {workers.map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total heures</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(totalMinutes)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fiches complétées</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSheets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Moy. par tâche</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgPerTask)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ouvriers actifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workerSummary.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Worker Summary */}
      {selectedWorker === "all" && workerSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Résumé par ouvrier</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ouvrier</TableHead>
                  <TableHead className="text-right">Tâches</TableHead>
                  <TableHead className="text-right">Temps total</TableHead>
                  <TableHead className="text-right">Moyenne</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workerSummary.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="text-right">{w.tasks}</TableCell>
                    <TableCell className="text-right font-medium">{formatDuration(w.minutes)}</TableCell>
                    <TableCell className="text-right">{formatDuration(Math.round(w.minutes / w.tasks))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail des interventions ({filteredSheets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredSheets.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Aucune fiche complétée sur cette période</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Ouvrier</TableHead>
                  <TableHead>Tâche</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Arrivée</TableHead>
                  <TableHead>Départ</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSheets.map((s) => {
                  const mins = s.arrival_time && s.departure_time
                    ? Math.max(0, differenceInMinutes(new Date(s.departure_time), new Date(s.arrival_time)))
                    : 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        {s.task?.scheduled_date
                          ? format(parseISO(s.task.scheduled_date), "dd/MM/yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>{s.worker?.full_name || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{s.task?.title || "-"}</TableCell>
                      <TableCell>{s.task?.client?.name || "-"}</TableCell>
                      <TableCell>
                        {s.task?.intervention_type && (
                          <Badge variant="outline" className="text-xs">
                            {INTERVENTION_TYPE_LABELS[s.task.intervention_type] || s.task.intervention_type}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.arrival_time ? format(new Date(s.arrival_time), "HH:mm") : "-"}
                      </TableCell>
                      <TableCell>
                        {s.departure_time ? format(new Date(s.departure_time), "HH:mm") : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatDuration(mins)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
