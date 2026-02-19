import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { Package, AlertTriangle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import CreateOrderDialog from "@/components/commandes/CreateOrderDialog";
import OrderDetailDialog from "@/components/commandes/OrderDetailDialog";

const statusColors: Record<string, string> = {
  demandee: "bg-order-demandee text-white",
  commandee: "bg-order-commandee text-white",
  recue: "bg-order-recue text-white",
  cloturee: "bg-order-cloturee text-white",
};

const urgencyColors: Record<string, string> = {
  normal: "",
  urgent: "border-l-4 border-l-urgency-urgent",
  critique: "border-l-4 border-l-urgency-critique",
};

export default function Commandes() {
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const fetchOrders = useCallback(async () => {
    const query = supabase
      .from("parts_orders")
      .select("*, clients(name), work_tasks(title), profiles!parts_orders_requested_by_fkey(full_name)")
      .order("created_at", { ascending: false });
    if (activeTab !== "all") {
      query.eq("status", activeTab as "demandee" | "commandee" | "recue" | "cloturee");
    }
    const { data } = await query;
    setOrders(data ?? []);
  }, [activeTab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleOrderUpdated = () => {
    setSelectedOrder(null);
    fetchOrders();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commandes & Pièces</h1>
          <p className="text-muted-foreground">{orders.length} commande(s)</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nouvelle commande
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="demandee">Demandées</TabsTrigger>
          <TabsTrigger value="commandee">Commandées</TabsTrigger>
          <TabsTrigger value="recue">Reçues</TabsTrigger>
          <TabsTrigger value="cloturee">Clôturées</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {orders.map((order) => (
          <Card
            key={order.id}
            className={cn("animate-slide-in cursor-pointer hover:shadow-md transition-shadow", urgencyColors[order.urgency])}
            onClick={() => setSelectedOrder(order)}
          >
            <CardContent className="py-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{order.part_name}</div>
                <div className="text-sm text-muted-foreground">
                  {order.clients?.name} · {order.work_tasks?.title} · Qté: {order.quantity}
                </div>
              </div>
              {order.urgency !== "normal" && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {order.urgency === "critique" ? "Critique" : "Urgent"}
                </Badge>
              )}
              <Badge className={cn(statusColors[order.status])}>
                {ORDER_STATUS_LABELS[order.status]}
              </Badge>
              <div className="text-xs text-muted-foreground">
                {format(new Date(order.created_at), "d MMM", { locale: fr })}
              </div>
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            Aucune commande
          </div>
        )}
      </div>

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={fetchOrders} />
      <OrderDetailDialog open={!!selectedOrder} onOpenChange={(o) => { if (!o) setSelectedOrder(null); }} order={selectedOrder} onUpdated={handleOrderUpdated} />
    </div>
  );
}
