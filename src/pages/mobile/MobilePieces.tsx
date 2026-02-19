import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { Package } from "lucide-react";

const statusColors: Record<string, string> = {
  demandee: "bg-order-demandee text-white",
  commandee: "bg-order-commandee text-white",
  recue: "bg-order-recue text-white",
  cloturee: "bg-order-cloturee text-white",
};

export default function MobilePieces() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("parts_orders")
        .select("*, clients(name), work_tasks(title)")
        .eq("requested_by", user.id)
        .order("created_at", { ascending: false });
      setOrders(data ?? []);
    };
    fetch();
  }, [user]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Mes pièces</h1>
      <div className="space-y-2">
        {orders.map((o) => (
          <Card key={o.id}>
            <CardContent className="py-3 flex items-center gap-3">
              <Package className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <div className="font-medium">{o.part_name}</div>
                <div className="text-sm text-muted-foreground">{o.clients?.name} · Qté: {o.quantity}</div>
              </div>
              <Badge className={statusColors[o.status]}>
                {ORDER_STATUS_LABELS[o.status]}
              </Badge>
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">Aucune demande de pièce</div>
        )}
      </div>
    </div>
  );
}
