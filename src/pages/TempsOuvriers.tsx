import { useEffect, useState, useMemo, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INTERVENTION_TYPE_LABELS, FILTER_TYPE_GROUPS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Clock, Users, Calendar, TrendingUp, Download, Search, ArrowUpDown, BarChart3 } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  parseISO,
  differenceInMinutes,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

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
  const m = Math.round(minutes % 60);
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function getDuration(s: SheetRow) {
  if (!s.arrival_time || !s.departure_time) return 0;
  return Math.max(0, differenceInMinutes(new Date(s.departure_time), new Date(s.arrival_time)));
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(35, 80%, 55%)",
  "hsl(280, 55%, 55%)",
  "hsl(0, 65%, 55%)",
  "hsl(190, 60%, 45%)",
];

type SortKey = "date" | "worker" | "client" | "type" | "duration";
type SortDir = "asc" | "desc";

export default function TempsOuvriers() {
  const { role } = useAuth();
  const [sheets, setSheets] = useState<SheetRow[]>([]);
  const [workers, setWorkers] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedWorker, setSelectedWorker] = useState("all");
  const [period, setPeriod] = useState("month");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
    switch (period) {
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "quarter":
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
      case "last3":
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [period]);

  const filteredSheets = useMemo(() => {
    return sheets.filter((s) => {
      if (selectedWorker !== "all" && s.worker_id !== selectedWorker) return false;
      if (!s.arrival_time || !s.departure_time) return false;
      const date = parseISO(s.task?.scheduled_date || s.created_at);
      if (date < periodRange.start || date > periodRange.end) return false;

      // Type filter
      if (typeFilter !== "all") {
        const group = FILTER_TYPE_GROUPS.find((g) => g.key === typeFilter);
        if (group) {
          if (!group.types.includes(s.task?.intervention_type || "")) return false;
        }
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          (s.worker?.full_name || "").toLowerCase().includes(q) ||
          (s.task?.title || "").toLowerCase().includes(q) ||
          (s.task?.client?.name || "").toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [sheets, selectedWorker, periodRange, typeFilter, searchQuery]);

  // Sorting
  const sortedSheets = useMemo(() => {
    const arr = [...filteredSheets];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = (a.task?.scheduled_date || a.created_at).localeCompare(b.task?.scheduled_date || b.created_at);
          break;
        case "worker":
          cmp = (a.worker?.full_name || "").localeCompare(b.worker?.full_name || "");
          break;
        case "client":
          cmp = (a.task?.client?.name || "").localeCompare(b.task?.client?.name || "");
          break;
        case "type":
          cmp = (a.task?.intervention_type || "").localeCompare(b.task?.intervention_type || "");
          break;
        case "duration":
          cmp = getDuration(a) - getDuration(b);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredSheets, sortKey, sortDir]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(key === "duration" ? "desc" : "asc");
      }
    },
    [sortKey]
  );

  const totalMinutes = useMemo(() => {
    return filteredSheets.reduce((acc, s) => acc + getDuration(s), 0);
  }, [filteredSheets]);

  const workerSummary = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; tasks: number }>();
    filteredSheets.forEach((s) => {
      const mins = getDuration(s);
      if (!mins) return;
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

  // Chart data: hours per worker
  const workerChartData = useMemo(
    () => workerSummary.map((w) => ({ name: w.name.split(" ")[0], heures: +(w.minutes / 60).toFixed(1), taches: w.tasks })),
    [workerSummary]
  );

  // Chart data: distribution by intervention type
  const typeDistribution = useMemo(() => {
    const map = new Map<string, number>();
    filteredSheets.forEach((s) => {
      const type = s.task?.intervention_type || "autre";
      const label = INTERVENTION_TYPE_LABELS[type] || type;
      map.set(label, (map.get(label) || 0) + getDuration(s));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: +(value / 60).toFixed(1) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSheets]);

  // Chart data: daily trend
  const dailyTrend = useMemo(() => {
    const days = eachDayOfInterval({ start: periodRange.start, end: periodRange.end > now ? now : periodRange.end });
    return days.map((day) => {
      const daySheets = filteredSheets.filter((s) => {
        const d = parseISO(s.task?.scheduled_date || s.created_at);
        return isSameDay(d, day);
      });
      const mins = daySheets.reduce((acc, s) => acc + getDuration(s), 0);
      return { date: format(day, "dd/MM"), heures: +(mins / 60).toFixed(1), fiches: daySheets.length };
    });
  }, [filteredSheets, periodRange]);

  const exportCSV = () => {
    const headers = ["Date", "Ouvrier", "Tâche", "Client", "Type", "Arrivée", "Départ", "Durée (min)"];
    const rows = sortedSheets.map((s) => {
      const mins = getDuration(s);
      return [
        s.task?.scheduled_date ? format(parseISO(s.task.scheduled_date), "dd/MM/yyyy") : "",
        s.worker?.full_name || "",
        s.task?.title || "",
        s.task?.client?.name || "",
        s.task?.intervention_type ? (INTERVENTION_TYPE_LABELS[s.task.intervention_type] || s.task.intervention_type) : "",
        s.arrival_time ? format(new Date(s.arrival_time), "HH:mm") : "",
        s.departure_time ? format(new Date(s.departure_time), "HH:mm") : "",
        mins.toString(),
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `temps-travail-${period}-${format(now, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (role && role !== "admin" && role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  const SortHeader = ({ label, colKey }: { label: string; colKey: SortKey }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => toggleSort(colKey)}
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortKey === colKey ? "text-primary" : "text-muted-foreground/50"}`} />
    </button>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Temps de travail</h1>
          <p className="text-muted-foreground">
            Suivi détaillé du temps de travail —{" "}
            {format(periodRange.start, "d MMM", { locale: fr })} au{" "}
            {format(periodRange.end, "d MMM yyyy", { locale: fr })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredSheets.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Cette semaine</SelectItem>
            <SelectItem value="month">Ce mois</SelectItem>
            <SelectItem value="quarter">Ce trimestre</SelectItem>
            <SelectItem value="last3">3 derniers mois</SelectItem>
            <SelectItem value="year">Cette année</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedWorker} onValueChange={setSelectedWorker}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tous les ouvriers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les ouvriers</SelectItem>
            {workers.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {FILTER_TYPE_GROUPS.map((g) => (
              <SelectItem key={g.key} value={g.key}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher ouvrier, tâche, client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total heures</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(totalMinutes)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(totalMinutes / 60).toFixed(0)} heures décimales
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fiches complétées</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSheets.length}</div>
            <p className="text-xs text-muted-foreground mt-1">interventions réalisées</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Moy. par tâche</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgPerTask)}</div>
            <p className="text-xs text-muted-foreground mt-1">durée moyenne</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ouvriers actifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workerSummary.length}</div>
            <p className="text-xs text-muted-foreground mt-1">sur la période</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Charts / Tables */}
      <Tabs defaultValue="charts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="charts" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Graphiques
          </TabsTrigger>
          <TabsTrigger value="summary">Résumé ouvriers</TabsTrigger>
          <TabsTrigger value="detail">Détail ({sortedSheets.length})</TabsTrigger>
        </TabsList>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-4">
          {filteredSheets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
                <p>Aucune donnée sur cette période</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Daily Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Évolution quotidienne</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="h" />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [
                          `${value}h`,
                          name === "heures" ? "Heures" : "Fiches",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="heures"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Worker Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Heures par ouvrier</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={workerChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [
                            `${value}h`,
                            name === "heures" ? "Heures" : "Tâches",
                          ]}
                        />
                        <Bar dataKey="heures" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Type Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Répartition par type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={typeDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, value }) => `${name} (${value}h)`}
                        >
                          {typeDistribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <RechartsTooltip formatter={(value: number) => [`${value}h`, "Heures"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Worker Summary Tab */}
        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Résumé par ouvrier</CardTitle>
            </CardHeader>
            <CardContent>
              {workerSummary.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">Aucune donnée</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ouvrier</TableHead>
                      <TableHead className="text-right">Tâches</TableHead>
                      <TableHead className="text-right">Temps total</TableHead>
                      <TableHead className="text-right">Moyenne</TableHead>
                      <TableHead className="text-right">% du total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workerSummary.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell className="text-right">{w.tasks}</TableCell>
                        <TableCell className="text-right font-medium">{formatDuration(w.minutes)}</TableCell>
                        <TableCell className="text-right">{formatDuration(Math.round(w.minutes / w.tasks))}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {totalMinutes > 0 ? ((w.minutes / totalMinutes) * 100).toFixed(0) : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{filteredSheets.length}</TableCell>
                      <TableCell className="text-right">{formatDuration(totalMinutes)}</TableCell>
                      <TableCell className="text-right">{formatDuration(avgPerTask)}</TableCell>
                      <TableCell className="text-right">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detail Tab */}
        <TabsContent value="detail">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : sortedSheets.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">Aucune fiche complétée sur cette période</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <SortHeader label="Date" colKey="date" />
                      </TableHead>
                      <TableHead>
                        <SortHeader label="Ouvrier" colKey="worker" />
                      </TableHead>
                      <TableHead>Tâche</TableHead>
                      <TableHead>
                        <SortHeader label="Client" colKey="client" />
                      </TableHead>
                      <TableHead>
                        <SortHeader label="Type" colKey="type" />
                      </TableHead>
                      <TableHead>Arrivée</TableHead>
                      <TableHead>Départ</TableHead>
                      <TableHead className="text-right">
                        <SortHeader label="Durée" colKey="duration" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSheets.map((s) => {
                      const mins = getDuration(s);
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
