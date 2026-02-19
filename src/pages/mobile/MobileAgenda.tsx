import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS, TASK_STATUS_LABELS } from "@/lib/constants";
import { ChevronLeft, ChevronRight, Phone, MapPin, MessageSquare, Package } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export default function MobileAgenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("work_tasks")
        .select("*, clients(name, phone, address_intervention), client_sites(address)")
        .eq("assigned_to", user.id)
        .eq("scheduled_date", format(currentDate, "yyyy-MM-dd"))
        .order("start_time");
      setTasks(data ?? []);
    };
    fetch();
  }, [currentDate, user]);

  return (
    <div className="p-4 space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate((d) => subDays(d, 1))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <div className="text-lg font-bold capitalize">
            {format(currentDate, "EEEE", { locale: fr })}
          </div>
          <div className="text-sm text-muted-foreground">
            {format(currentDate, "d MMMM yyyy", { locale: fr })}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate((d) => addDays(d, 1))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Tasks */}
      <div className="space-y-3">
        {tasks.map((task) => (
          <Card
            key={task.id}
            className="animate-slide-in cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate(`/mobile/tache/${task.id}`)}
          >
            <CardContent className="py-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold text-primary">
                    {task.start_time?.slice(0, 5)} · {task.duration_minutes} min
                  </div>
                  <div className="font-semibold">{task.title}</div>
                </div>
                <Badge className={cn("text-xs", INTERVENTION_TYPE_COLORS[task.intervention_type])}>
                  {INTERVENTION_TYPE_LABELS[task.intervention_type]}
                </Badge>
              </div>

              <div className="text-sm text-muted-foreground">{task.description}</div>

              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="truncate">{task.client_sites?.address || task.clients?.address_intervention}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{task.clients?.name}</div>
                <div className="flex gap-1.5">
                  {task.memo_secretariat && (
                    <div className="p-1 rounded bg-accent/10">
                      <MessageSquare className="w-3.5 h-3.5 text-accent" />
                    </div>
                  )}
                  {task.status === "piece_a_commander" && (
                    <div className="p-1 rounded bg-status-piece/10">
                      <Package className="w-3.5 h-3.5 text-status-piece" />
                    </div>
                  )}
                </div>
              </div>

              {task.material_needed && (
                <div className="text-xs bg-muted rounded-md px-2 py-1">
                  🔧 {task.material_needed}
                </div>
              )}

              {/* Quick action buttons */}
              <div className="flex gap-2 pt-1">
                {task.clients?.phone && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `tel:${task.clients.phone}`;
                    }}
                  >
                    <Phone className="w-3.5 h-3.5 mr-1" /> Appeler
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    const addr = task.client_sites?.address || task.clients?.address_intervention;
                    if (addr) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`);
                  }}
                >
                  <MapPin className="w-3.5 h-3.5 mr-1" /> GPS
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {tasks.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-2">📋</div>
            Aucune tâche aujourd'hui
          </div>
        )}
      </div>
    </div>
  );
}
