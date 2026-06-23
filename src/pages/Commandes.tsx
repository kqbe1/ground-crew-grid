import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { Package, AlertTriangle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import CreateOrderDialog from "@/components/commandes/CreateOrderDialog";
import LayoutPage from "@/components/layout/LayoutPage";
import { SheetStatusBadge, computeSheetStatus, sheetStatusBorderClass } from "@/components/shared/SheetStatusBadge";

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
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const fetchOrders = useCallback(async () => {
    const query = supabase
      .from("parts_orders")
      .select("*, clients(name), work_tasks(title, intervention_sheets(is_draft, final_status)), profiles!parts_orders_requested_by_fkey(full_name)")
      .order("created_at", { ascending: false });
    if (activeTab !== "all") {
      query.eq("status", activeTab as "demandee" | "commandee" | "recue" | "cloturee");
    }
    const { data } = await query;
    setOrders(data ?? []);
  }, [activeTab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <LayoutPage
      icon={Package}
      title="Commandes"
      subtitle={`${orders.length} commande${orders.length > 1 ? "s" : ""}`}
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nouvelle
        </Button>
      }
      toolbar={
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="demandee">Demandées</TabsTrigger>
            <TabsTrigger value="commandee">Commandées</TabsTrigger>
            <TabsTrigger value="recue">Reçues</TabsTrigger>
            <TabsTrigger value="cloturee">Clôturées</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >

      <div className="space-y-2">
        {orders.map((order) => {
          const linkedSheet = order.work_tasks?.intervention_sheets?.[0];
          const sheetStatus = computeSheetStatus(linkedSheet);
          return (
          <Card
            key={order.id}
            className={cn(
              "animate-slide-in cursor-pointer hover:shadow-md transition-shadow",
              urgencyColors[order.urgency],
              sheetStatusBorderClass(sheetStatus),
            )}
            onClick={() => navigate(`/commandes/${order.id}`)}
          >
            <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Package className="w-4 h-4 text-primary" /></div>
                <div className="min-w-0">
                  <div className="font-medium text-sm">{order.part_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{order.clients?.name} · Qté: {order.quantity}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {order.urgency !== "normal" && (
                  <Badge variant="destructive" className="gap-1 text-xs"><AlertTriangle className="w-3 h-3" />{order.urgency === "critique" ? "Critique" : "Urgent"}</Badge>
                )}
                <SheetStatusBadge status={sheetStatus} />
                <Badge className={cn(statusColors[order.status], "text-xs")}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(order.created_at), "d MMM", { locale: fr })}</span>
              </div>
            </CardContent>
          </Card>
          );
        })}
        {orders.length === 0 && <div className="py-12 text-center text-muted-foreground">Aucune commande</div>}
      </div>

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={fetchOrders} />
    </LayoutPage>
  );
}
