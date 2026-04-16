import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Package, Users, Wrench, AlertTriangle, CalendarDays, ClipboardList, ArrowRight, TrendingUp, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { TASK_STATUS_LABELS, INTERVENTION_TYPE_LABELS, ORDER_STATUS_LABELS } from "@/lib/constants";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid,
} from "recharts";
import LegalAlertsPanel from "@/components/dashboard/LegalAlertsPanel";
import PartsReceivedPanel from "@/components/dashboard/PartsReceivedPanel";
import RecentSheetsPanel from "@/components/dashboard/RecentSheetsPanel";

const CHART_COLORS = [
  "hsl(220, 72%, 50%)",
  "hsl(260, 60%, 55%)",
  "hsl(142, 55%, 42%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(199, 89%, 48%)",
  "hsl(280, 65%, 42%)",
  "hsl(330, 65%, 52%)",
  "hsl(15, 80%, 40%)",
  "hsl(24, 95%, 53%)",
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    partsDemandees: 0,
    partsCommandees: 0,
    partsRecues: 0,
    entretiensThisMonth: 0,
    entretiensNextMonth: 0,
    tasksWaiting: 0,
    totalClients: 0,
    fichesThisMonth: 0,
  });
  const [waitingTasks, setWaitingTasks] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [urgentEntretiens, setUrgentEntretiens] = useState<any[]>([]);
  const [interventionsByType, setInterventionsByType] = useState<any[]>([]);
  const [monthlyActivity, setMonthlyActivity] = useState<any[]>([]);
  const [taskStatusDistribution, setTaskStatusDistribution] = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0];
      const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];
      const in30days = new Date(now.getTime() + 30 * 86400000).toISOString().split("T")[0];

      const sixMonthsAgo = startOfMonth(subMonths(now, 5));

      const [
        partsDem, partsCom, partsRec,
        entThisMonth, entNextMonth,
        waiting, clients, fichesMonth,
        waitingList, ordersList, urgentList,
        allTasks, allSheets,
      ] = await Promise.all([
        supabase.from("parts_orders").select("id", { count: "exact" }).eq("status", "demandee"),
        supabase.from("parts_orders").select("id", { count: "exact" }).eq("status", "commandee"),
        supabase.from("parts_orders").select("id", { count: "exact" }).eq("status", "recue"),
        supabase.from("maintenance_schedules").select("id", { count: "exact" }).gte("next_due_date", monthStart).lte("next_due_date", monthEnd),
        supabase.from("maintenance_schedules").select("id", { count: "exact" }).gte("next_due_date", nextMonthStart).lte("next_due_date", nextMonthEnd),
        supabase.from("work_tasks").select("id", { count: "exact" }).in("status", ["a_replanifier", "piece_a_commander", "sav"]),
        supabase.from("clients").select("id", { count: "exact" }),
        supabase.from("intervention_sheets").select("id", { count: "exact" }).gte("created_at", new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
        supabase.from("work_tasks").select("id, title, status, wait_reason, clients(name)").in("status", ["a_replanifier", "piece_a_commander", "sav"]).order("updated_at", { ascending: false }).limit(5),
        supabase.from("parts_orders").select("id, part_name, status, urgency, clients(name)").neq("status", "cloturee").order("created_at", { ascending: false }).limit(5),
        supabase.from("maintenance_schedules").select("id, intervention_type, next_due_date, clients(name)").lte("next_due_date", in30days).order("next_due_date", { ascending: true }).limit(5),
        supabase.from("work_tasks").select("intervention_type, status, scheduled_date").gte("scheduled_date", sixMonthsAgo.toISOString().split("T")[0]),
        supabase.from("intervention_sheets").select("created_at").gte("created_at", sixMonthsAgo.toISOString()),
      ]);

      setStats({
        partsDemandees: partsDem.count ?? 0,
        partsCommandees: partsCom.count ?? 0,
        partsRecues: partsRec.count ?? 0,
        entretiensThisMonth: entThisMonth.count ?? 0,
        entretiensNextMonth: entNextMonth.count ?? 0,
        tasksWaiting: waiting.count ?? 0,
        totalClients: clients.count ?? 0,
        fichesThisMonth: fichesMonth.count ?? 0,
      });
      setWaitingTasks(waitingList.data ?? []);
      setRecentOrders(ordersList.data ?? []);
      setUrgentEntretiens(urgentList.data ?? []);

      const tasks = allTasks.data ?? [];
      const typeCounts: Record<string, number> = {};
      tasks.forEach((t) => {
        typeCounts[t.intervention_type] = (typeCounts[t.intervention_type] || 0) + 1;
      });
      setInterventionsByType(
        Object.entries(typeCounts)
          .map(([key, value]) => ({ name: INTERVENTION_TYPE_LABELS[key] || key, value }))
          .sort((a, b) => b.value - a.value)
      );

      const statusCounts: Record<string, number> = {};
      tasks.forEach((t) => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
      const STATUS_COLORS: Record<string, string> = {
        planifie: "hsl(220, 72%, 50%)",
        termine: "hsl(142, 55%, 42%)",
        a_replanifier: "hsl(38, 92%, 50%)",
        piece_a_commander: "hsl(280, 60%, 55%)",
        sav: "hsl(15, 80%, 50%)",
      };
      setTaskStatusDistribution(
        Object.entries(statusCounts).map(([key, value]) => ({
          name: TASK_STATUS_LABELS[key] || key, value, color: STATUS_COLORS[key] || "hsl(220, 10%, 46%)",
        }))
      );

      const sheets = allSheets.data ?? [];
      const months: { label: string; tasks: number; fiches: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(now, i);
        const mStart = startOfMonth(m);
        const mEnd = endOfMonth(m);
        const label = format(m, "MMM yy", { locale: fr });
        const taskCount = tasks.filter((t) => { const d = new Date(t.scheduled_date); return d >= mStart && d <= mEnd; }).length;
        const ficheCount = sheets.filter((s) => { const d = new Date(s.created_at); return d >= mStart && d <= mEnd; }).length;
        months.push({ label, tasks: taskCount, fiches: ficheCount });
      }
      setMonthlyActivity(months);
    };
    fetchAll();
  }, []);

  const statCards = [
    { title: "Travaux en attente", value: stats.tasksWaiting, icon: AlertTriangle, color: "text-accent", bg: "bg-accent/10", link: "/planning" },
    { title: "Entretiens ce mois", value: stats.entretiensThisMonth, icon: Wrench, color: "text-primary", bg: "bg-primary/10", link: "/entretiens" },
    { title: "Entretiens mois prochain", value: stats.entretiensNextMonth, icon: CalendarDays, color: "text-secondary", bg: "bg-secondary/10", link: "/entretiens" },
    { title: "Pièces demandées", value: stats.partsDemandees, icon: Package, color: "text-[hsl(var(--color-demandee))]", bg: "bg-[hsl(var(--color-demandee))]/10", link: "/commandes" },
    { title: "Pièces commandées", value: stats.partsCommandees, icon: Package, color: "text-[hsl(var(--color-commandee))]", bg: "bg-[hsl(var(--color-commandee))]/10", link: "/commandes" },
    { title: "Pièces reçues", value: stats.partsRecues, icon: Package, color: "text-[hsl(var(--color-recue))]", bg: "bg-[hsl(var(--color-recue))]/10", link: "/commandes" },
  ];

  const urgencyBorder: Record<string, string> = {
    normal: "",
    urgent: "border-l-4 border-l-[hsl(var(--color-urgent))]",
    critique: "border-l-4 border-l-[hsl(var(--color-critique))]",
  };

  const statusColor: Record<string, string> = {
    a_replanifier: "bg-[hsl(var(--color-replanifier))] text-white",
    piece_a_commander: "bg-[hsl(var(--color-piece))] text-white",
    sav: "bg-[hsl(var(--color-sav))] text-white",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Vue d'ensemble de l'activité</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="cursor-pointer hover:shadow-md transition-shadow group" onClick={() => navigate(card.link)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
              <div className={`p-2 rounded-lg ${card.bg}`}><card.icon className={`w-4 h-4 ${card.color}`} /></div>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div className="text-3xl font-bold">{card.value}</div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />Activité mensuelle (6 mois)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyActivity} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 88%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(220, 13%, 88%)", borderRadius: "8px", fontSize: 12 }} />
                  <Area type="monotone" dataKey="tasks" name="Travaux planifiés" stroke="hsl(220, 72%, 50%)" fill="hsl(220, 72%, 50%)" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="fiches" name="Fiches complétées" stroke="hsl(142, 55%, 42%)" fill="hsl(142, 55%, 42%)" fillOpacity={0.15} strokeWidth={2} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-secondary" />Répartition par type d'intervention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {interventionsByType.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={interventionsByType} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 88%)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="hsl(220, 10%, 46%)" width={100} />
                    <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(220, 13%, 88%)", borderRadius: "8px", fontSize: 12 }} />
                    <Bar dataKey="value" name="Interventions" radius={[0, 4, 4, 0]}>
                      {interventionsByType.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RecentSheetsPanel />
        <LegalAlertsPanel />
        <PartsReceivedPanel />

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Statut des travaux</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52">
              {taskStatusDistribution.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={taskStatusDistribution} cx="50%" cy="45%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                      {taskStatusDistribution.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(220, 13%, 88%)", borderRadius: "8px", fontSize: 12 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/planning")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-accent" />Travaux en attente</CardTitle>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {waitingTasks.length === 0 && <p className="text-sm text-muted-foreground">Aucun travail en attente</p>}
            {waitingTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.clients?.name}{t.wait_reason ? ` · ${t.wait_reason}` : ""}</div>
                </div>
                <Badge className={`text-[10px] ml-2 ${statusColor[t.status] || ""}`}>{TASK_STATUS_LABELS[t.status]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/commandes")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-[hsl(var(--color-commandee))]" />Commandes en cours</CardTitle>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentOrders.length === 0 && <p className="text-sm text-muted-foreground">Aucune commande active</p>}
            {recentOrders.map((o) => (
              <div key={o.id} className={`flex items-center justify-between text-sm py-1.5 border-b last:border-0 rounded ${urgencyBorder[o.urgency] || ""}`}>
                <div className="min-w-0 flex-1 pl-1">
                  <div className="font-medium truncate">{o.part_name}</div>
                  <div className="text-xs text-muted-foreground">{o.clients?.name}</div>
                </div>
                <Badge variant="outline" className="text-[10px] ml-2">{ORDER_STATUS_LABELS[o.status]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/entretiens")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Wrench className="w-4 h-4 text-primary" />Entretiens à venir</CardTitle>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {urgentEntretiens.length === 0 && <p className="text-sm text-muted-foreground">Aucun entretien imminent</p>}
            {urgentEntretiens.map((e) => {
              const days = differenceInDays(new Date(e.next_due_date), new Date());
              const isOverdue = days < 0;
              return (
                <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{e.clients?.name}</div>
                    <div className="text-xs text-muted-foreground">{INTERVENTION_TYPE_LABELS[e.intervention_type]}</div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ml-2 ${isOverdue ? "border-destructive text-destructive" : days <= 7 ? "border-[hsl(var(--color-urgent))] text-[hsl(var(--color-urgent))]" : ""}`}>
                    {isOverdue ? `${Math.abs(days)}j retard` : `${days}j`}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
