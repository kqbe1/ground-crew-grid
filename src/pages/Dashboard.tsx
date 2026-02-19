import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Package, Users, Wrench, AlertTriangle, CalendarDays } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({
    partsDemandees: 0,
    partsCommandees: 0,
    partsRecues: 0,
    entretiensThisMonth: 0,
    entretiensNextMonth: 0,
    tasksWaiting: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0];
      const endNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];

      const [partsDem, partsCom, partsRec, entThisMonth, entNextMonth, waiting] = await Promise.all([
        supabase.from("parts_orders").select("id", { count: "exact", head: true }).eq("status", "demandee"),
        supabase.from("parts_orders").select("id", { count: "exact", head: true }).eq("status", "commandee"),
        supabase.from("parts_orders").select("id", { count: "exact", head: true }).eq("status", "recue"),
        supabase.from("maintenance_schedules").select("id", { count: "exact", head: true }).gte("next_due_date", startOfMonth).lte("next_due_date", endOfMonth),
        supabase.from("maintenance_schedules").select("id", { count: "exact", head: true }).gte("next_due_date", startNextMonth).lte("next_due_date", endNextMonth),
        supabase.from("work_tasks").select("id", { count: "exact", head: true }).in("status", ["a_replanifier", "piece_a_commander"]),
      ]);

      setStats({
        partsDemandees: partsDem.count ?? 0,
        partsCommandees: partsCom.count ?? 0,
        partsRecues: partsRec.count ?? 0,
        entretiensThisMonth: entThisMonth.count ?? 0,
        entretiensNextMonth: entNextMonth.count ?? 0,
        tasksWaiting: waiting.count ?? 0,
      });
    };
    fetchStats();
  }, []);

  const statCards = [
    { title: "Pièces demandées", value: stats.partsDemandees, icon: Package, color: "text-order-demandee", bg: "bg-order-demandee/10" },
    { title: "Pièces commandées", value: stats.partsCommandees, icon: Package, color: "text-order-commandee", bg: "bg-order-commandee/10" },
    { title: "Pièces reçues", value: stats.partsRecues, icon: Package, color: "text-order-recue", bg: "bg-order-recue/10" },
    { title: "Entretiens ce mois", value: stats.entretiensThisMonth, icon: Wrench, color: "text-primary", bg: "bg-primary/10" },
    { title: "Entretiens mois prochain", value: stats.entretiensNextMonth, icon: CalendarDays, color: "text-secondary", bg: "bg-secondary/10" },
    { title: "Travaux en attente", value: stats.tasksWaiting, icon: AlertTriangle, color: "text-accent", bg: "bg-accent/10" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Vue d'ensemble de l'activité</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="animate-slide-in">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
