import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Package, Users, Wrench, AlertTriangle, CalendarDays, ClipboardList, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { TASK_STATUS_LABELS, INTERVENTION_TYPE_LABELS, ORDER_STATUS_LABELS } from "@/lib/constants";

export default function Dashboard() {
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

  useEffect(() => {
    const fetchAll = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0];
      const endNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];
      const in30days = new Date(now.getTime() + 30 * 86400000).toISOString().split("T")[0];

      const [partsDem, partsCom, partsRec, entThisMonth, entNextMonth, waiting, clients, fichesMonth, waitingList, ordersList, urgentList] = await Promise.all([
        supabase.from("parts_orders").select("id", { count: "exact", head: true }).eq("status", "demandee"),
        supabase.from("parts_orders").select("id", { count: "exact", head: true }).eq("status", "commandee"),
        supabase.from("parts_orders").select("id", { count: "exact", head: true }).eq("status", "recue"),
        supabase.from("maintenance_schedules").select("id", { count: "exact", head: true }).gte("next_due_date", startOfMonth).lte("next_due_date", endOfMonth),
        supabase.from("maintenance_schedules").select("id", { count: "exact", head: true }).gte("next_due_date", startNextMonth).lte("next_due_date", endNextMonth),
        supabase.from("work_tasks").select("id", { count: "exact", head: true }).in("status", ["a_replanifier", "piece_a_commander"]),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("intervention_sheets").select("id", { count: "exact", head: true }).gte("created_at", new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
        supabase.from("work_tasks").select("id, title, status, wait_reason, clients(name)").in("status", ["a_replanifier", "piece_a_commander"]).order("updated_at", { ascending: false }).limit(5),
        supabase.from("parts_orders").select("id, part_name, status, urgency, clients(name)").neq("status", "cloturee").order("created_at", { ascending: false }).limit(5),
        supabase.from("maintenance_schedules").select("id, intervention_type, next_due_date, clients(name)").lte("next_due_date", in30days).order("next_due_date", { ascending: true }).limit(5),
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
    };
    fetchAll();
  }, []);

  const statCards = [
    { title: "Pièces demandées", value: stats.partsDemandees, icon: Package, color: "text-[hsl(var(--color-demandee))]", bg: "bg-[hsl(var(--color-demandee))]/10", link: "/commandes" },
    { title: "Pièces commandées", value: stats.partsCommandees, icon: Package, color: "text-[hsl(var(--color-commandee))]", bg: "bg-[hsl(var(--color-commandee))]/10", link: "/commandes" },
    { title: "Pièces reçues", value: stats.partsRecues, icon: Package, color: "text-[hsl(var(--color-recue))]", bg: "bg-[hsl(var(--color-recue))]/10", link: "/commandes" },
    { title: "Entretiens ce mois", value: stats.entretiensThisMonth, icon: Wrench, color: "text-primary", bg: "bg-primary/10", link: "/entretiens" },
    { title: "Entretiens mois prochain", value: stats.entretiensNextMonth, icon: CalendarDays, color: "text-secondary", bg: "bg-secondary/10", link: "/entretiens" },
    { title: "Travaux en attente", value: stats.tasksWaiting, icon: AlertTriangle, color: "text-accent", bg: "bg-accent/10", link: "/planning" },
    { title: "Clients", value: stats.totalClients, icon: Users, color: "text-primary", bg: "bg-primary/10", link: "/clients" },
    { title: "Fiches ce mois", value: stats.fichesThisMonth, icon: ClipboardList, color: "text-secondary", bg: "bg-secondary/10", link: "/fiches" },
  ];

  const urgencyBorder: Record<string, string> = {
    normal: "",
    urgent: "border-l-4 border-l-[hsl(var(--color-urgent))]",
    critique: "border-l-4 border-l-[hsl(var(--color-critique))]",
  };

  const statusColor: Record<string, string> = {
    a_replanifier: "bg-[hsl(var(--color-replanifier))] text-white",
    piece_a_commander: "bg-[hsl(var(--color-piece))] text-white",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Vue d'ensemble de l'activité</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card
            key={card.title}
            className="cursor-pointer hover:shadow-md transition-shadow group"
            onClick={() => navigate(card.link)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div className="text-3xl font-bold">{card.value}</div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Travaux en attente */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/planning")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-accent" />
                Travaux en attente
              </CardTitle>
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
                <Badge className={`text-[10px] ml-2 ${statusColor[t.status] || ""}`}>
                  {TASK_STATUS_LABELS[t.status]}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Commandes en cours */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/commandes")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-[hsl(var(--color-commandee))]" />
                Commandes en cours
              </CardTitle>
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
                <Badge variant="outline" className="text-[10px] ml-2">
                  {ORDER_STATUS_LABELS[o.status]}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Entretiens urgents */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/entretiens")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" />
                Entretiens à venir
              </CardTitle>
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
