import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type NotifType = "new_order" | "order_received" | "task_completed" | "new_quote";

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  description: string;
  urgency?: string;
  created_at: string;
  read: boolean;
}

export default function RealtimeOrderNotifications() {
  const { role } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback((notif: Notification) => {
    setNotifications((prev) => [notif, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    if (role !== "admin" && role !== "bureau" && role !== "super_admin") return;

    // 1. New parts order from ouvrier
    const ordersChannel = supabase
      .channel("bureau-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "parts_orders" },
        async (payload) => {
          const order = payload.new as any;
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", order.requested_by)
            .maybeSingle();

          const urgencyLabel =
            order.urgency === "critique" ? "🔴 CRITIQUE" :
            order.urgency === "urgent" ? "🟠 URGENT" : "";

          const notif: Notification = {
            id: `order-${order.id}`,
            type: "new_order",
            title: `Demande de pièce${urgencyLabel ? ` ${urgencyLabel}` : ""}`,
            description: `${profile?.full_name ?? "Inconnu"} — ${order.part_name} (x${order.quantity})`,
            urgency: order.urgency,
            created_at: order.created_at,
            read: false,
          };
          addNotification(notif);
          toast.info(notif.title, { description: notif.description });
        }
      )
      .subscribe();

    // 2. Parts order status changed to "recue"
    const orderUpdateChannel = supabase
      .channel("bureau-order-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "parts_orders" },
        async (payload) => {
          const updated = payload.new as any;
          const old = payload.old as any;
          if (updated.status === "recue" && old.status !== "recue") {
            const { data: client } = updated.client_id
              ? await supabase.from("clients").select("name").eq("id", updated.client_id).maybeSingle()
              : { data: null };

            const notif: Notification = {
              id: `order-recv-${updated.id}-${Date.now()}`,
              type: "order_received",
              title: "📦 Pièce reçue — intervention à planifier",
              description: `${updated.part_name}${client?.name ? ` · ${client.name}` : ""}`,
              created_at: new Date().toISOString(),
              read: false,
            };
            addNotification(notif);
            toast.success(notif.title, { description: notif.description });
          }
        }
      )
      .subscribe();

    // 3. Task completed by ouvrier (intervention sheet inserted with is_draft=false)
    const sheetChannel = supabase
      .channel("bureau-sheets")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "intervention_sheets" },
        async (payload) => {
          const sheet = payload.new as any;
          if (sheet.is_draft) return;

          const [{ data: worker }, { data: task }] = await Promise.all([
            supabase.from("profiles").select("full_name").eq("id", sheet.worker_id).maybeSingle(),
            supabase.from("work_tasks").select("title, clients(name)").eq("id", sheet.work_task_id).maybeSingle(),
          ]);

          const notif: Notification = {
            id: `sheet-${sheet.id}`,
            type: "task_completed",
            title: "✅ Tâche terminée par un ouvrier",
            description: `${worker?.full_name ?? "Ouvrier"} — ${task?.title ?? "Tâche"}${task?.clients?.name ? ` · ${task.clients.name}` : ""}`,
            created_at: sheet.created_at,
            read: false,
          };
          addNotification(notif);
          toast.success(notif.title, { description: notif.description });
        }
      )
      .subscribe();

    // 4. New quote from mobile
    const quotesChannel = supabase
      .channel("bureau-quotes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quotes" },
        async (payload) => {
          const q = payload.new as any;
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", q.created_by)
            .maybeSingle();

          const notif: Notification = {
            id: `quote-${q.id}`,
            type: "new_quote",
            title: `📋 Nouveau devis reçu${q.is_urgent ? " 🔴 URGENT" : ""}`,
            description: `${profile?.full_name ?? "Inconnu"} — ${q.client_name}`,
            created_at: q.created_at,
            read: false,
          };
          addNotification(notif);
          toast.info(notif.title, { description: notif.description });
        }
      )
      .subscribe();

    channelsRef.current = [ordersChannel, orderUpdateChannel, sheetChannel, quotesChannel];

    return () => {
      channelsRef.current.forEach((ch) => ch.unsubscribe());
    };
  }, [role, addNotification]);

  if (role !== "admin" && role !== "bureau" && role !== "super_admin") return null;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const typeIcon: Record<NotifType, string> = {
    new_order: "📦",
    order_received: "✅",
    task_completed: "🏁",
    new_quote: "📋",
  };

  const typeBg: Record<NotifType, string> = {
    new_order: "bg-[hsl(var(--color-demandee))]/10",
    order_received: "bg-[hsl(var(--color-recue))]/10",
    task_completed: "bg-[hsl(var(--color-termine))]/10",
    new_quote: "bg-rose-500/10",
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive rounded-full text-[10px] text-destructive-foreground flex items-center justify-center font-bold animate-pulse">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Tout marquer lu
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Aucune notification</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "px-4 py-3 border-b border-border last:border-0 text-sm",
                  !n.read && "bg-primary/5"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className={cn("flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm", typeBg[n.type])}>
                    {typeIcon[n.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">{n.title}</span>
                      {n.urgency && n.urgency !== "normal" && (
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded",
                          n.urgency === "critique" ? "bg-destructive/15 text-destructive" : "bg-[hsl(var(--color-urgent))]/15 text-[hsl(var(--color-urgent))]"
                        )}>
                          {n.urgency === "critique" ? "CRITIQUE" : "URGENT"}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs mt-0.5 truncate">{n.description}</div>
                    <div className="text-muted-foreground/60 text-[10px] mt-1">
                      {format(new Date(n.created_at), "d MMM HH:mm", { locale: fr })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
