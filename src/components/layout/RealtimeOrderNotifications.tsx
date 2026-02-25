import { useEffect, useState, useRef } from "react";
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

interface Notification {
  id: string;
  part_name: string;
  urgency: string;
  requester_name: string;
  created_at: string;
  read: boolean;
}

export default function RealtimeOrderNotifications() {
  const { role } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (role !== "admin" && role !== "secretariat") return;

    channelRef.current = supabase
      .channel("new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "parts_orders" },
        async (payload) => {
          const order = payload.new as any;

          // Fetch requester name
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", order.requested_by)
            .maybeSingle();

          const notif: Notification = {
            id: order.id,
            part_name: order.part_name,
            urgency: order.urgency,
            requester_name: profile?.full_name ?? "Inconnu",
            created_at: order.created_at,
            read: false,
          };

          setNotifications((prev) => [notif, ...prev].slice(0, 20));

          const urgencyLabel = order.urgency === "critique" ? "🔴 CRITIQUE" : order.urgency === "urgent" ? "🟠 URGENT" : "";
          toast.info(
            `Nouvelle demande de pièce${urgencyLabel ? ` ${urgencyLabel}` : ""}`,
            { description: `${notif.requester_name} — ${order.part_name} (x${order.quantity})` }
          );
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [role]);

  if (role !== "admin" && role !== "secretariat") return null;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive rounded-full text-[10px] text-destructive-foreground flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Tout marquer lu
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
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
                <div className="flex items-center gap-2">
                  <span className="font-medium">{n.part_name}</span>
                  {n.urgency !== "normal" && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded",
                      n.urgency === "critique" ? "bg-destructive/15 text-destructive" : "bg-orange-500/15 text-orange-600"
                    )}>
                      {n.urgency === "critique" ? "CRITIQUE" : "URGENT"}
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {n.requester_name} · {format(new Date(n.created_at), "d MMM HH:mm", { locale: fr })}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
