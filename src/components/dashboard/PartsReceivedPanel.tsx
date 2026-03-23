import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { PackageCheck, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ReceivedOrder {
  id: string;
  partName: string;
  clientName: string;
  receivedAt: string;
  taskId: string | null;
  taskTitle: string | null;
}

export default function PartsReceivedPanel() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ReceivedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("parts_orders")
        .select("id, part_name, received_at, work_task_id, clients(name), work_tasks(title)")
        .eq("status", "recue")
        .order("received_at", { ascending: false })
        .limit(8);

      if (data) {
        setOrders(
          data.map((o: any) => ({
            id: o.id,
            partName: o.part_name,
            clientName: o.clients?.name || "—",
            receivedAt: o.received_at || "",
            taskId: o.work_task_id,
            taskTitle: o.work_tasks?.title || null,
          }))
        );
      }
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/commandes")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-[hsl(var(--color-recue))]" />
            À planifier (pièces reçues)
          </CardTitle>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Chargement...</p>}
        {!loading && orders.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune pièce reçue en attente</p>
        )}
        {orders.map((o) => (
          <div key={o.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{o.partName}</div>
              <div className="text-xs text-muted-foreground">
                {o.clientName}
                {o.taskTitle ? ` · ${o.taskTitle}` : ""}
              </div>
            </div>
            {o.receivedAt && (
              <Badge variant="outline" className="text-[10px] ml-2 shrink-0">
                {formatDistanceToNow(new Date(o.receivedAt), { locale: fr, addSuffix: true })}
              </Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
