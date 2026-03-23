import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS } from "@/lib/constants";
import { ChevronLeft, ChevronRight, Phone, MapPin, MessageSquare, Package } from "lucide-react";
import {
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, isToday,
} from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type ViewMode = "jour" | "semaine" | "mois";

interface Task {
  id: string;
  title: string;
  start_time: string;
  duration_minutes: number;
  intervention_type: string;
  status: string;
  description: string | null;
  memo_secretariat: string | null;
  material_needed: string | null;
  scheduled_date: string;
  clients: { name: string; phone: string | null; address_intervention: string | null } | null;
  client_sites: { address: string } | null;
}

export default function MobileAgenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("jour");
  const [tasks, setTasks] = useState<Task[]>([]);

  // Compute date range based on view
  const dateRange = useMemo(() => {
    if (view === "jour") {
      const d = format(currentDate, "yyyy-MM-dd");
      return { from: d, to: d };
    }
    if (view === "semaine") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd") };
    }
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd") };
  }, [currentDate, view]);

  useEffect(() => {
    if (!user) return;
    const fetchTasks = async () => {
      const { data } = await supabase
        .from("work_tasks")
        .select("*, clients(name, phone, address_intervention), client_sites(address)")
        .eq("assigned_to", user.id)
        .gte("scheduled_date", dateRange.from)
        .lte("scheduled_date", dateRange.to)
        .order("start_time");
      setTasks((data as Task[]) ?? []);
    };
    fetchTasks();
  }, [dateRange, user]);

  // Navigation
  const goBack = () => {
    if (view === "jour") setCurrentDate((d) => subDays(d, 1));
    else if (view === "semaine") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subMonths(d, 1));
  };

  const goForward = () => {
    if (view === "jour") setCurrentDate((d) => addDays(d, 1));
    else if (view === "semaine") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };

  const headerLabel = useMemo(() => {
    if (view === "jour") {
      return (
        <div className="text-center">
          <div className="text-lg font-bold capitalize">{format(currentDate, "EEEE", { locale: fr })}</div>
          <div className="text-sm text-muted-foreground">{format(currentDate, "d MMMM yyyy", { locale: fr })}</div>
        </div>
      );
    }
    if (view === "semaine") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return (
        <div className="text-center">
          <div className="text-lg font-bold">Semaine {format(currentDate, "w")}</div>
          <div className="text-sm text-muted-foreground">
            {format(start, "d MMM", { locale: fr })} – {format(end, "d MMM yyyy", { locale: fr })}
          </div>
        </div>
      );
    }
    return (
      <div className="text-center">
        <div className="text-lg font-bold capitalize">{format(currentDate, "MMMM yyyy", { locale: fr })}</div>
      </div>
    );
  }, [currentDate, view]);

  return (
    <div className="p-4 space-y-3">
      {/* View tabs */}
      <div className="flex bg-muted rounded-lg p-0.5">
        {(["jour", "semaine", "mois"] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "flex-1 py-1.5 text-sm font-medium rounded-md transition-all capitalize",
              view === v
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        {headerLabel}
        <Button variant="ghost" size="icon" onClick={goForward}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      {view === "jour" && <DayView tasks={tasks} currentDate={currentDate} navigate={navigate} />}
      {view === "semaine" && (
        <WeekView tasks={tasks} currentDate={currentDate} navigate={navigate} onSelectDay={(d) => { setCurrentDate(d); setView("jour"); }} />
      )}
      {view === "mois" && (
        <MonthView tasks={tasks} currentDate={currentDate} onSelectDay={(d) => { setCurrentDate(d); setView("jour"); }} />
      )}
    </div>
  );
}

/* ─── Day View ─── */
function DayView({ tasks, currentDate, navigate }: { tasks: Task[]; currentDate: Date; navigate: (path: string) => void }) {
  const dayTasks = tasks.filter((t) => t.scheduled_date === format(currentDate, "yyyy-MM-dd"));

  if (dayTasks.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <div className="text-4xl mb-2">📋</div>
        Aucune tâche ce jour
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {dayTasks.map((task) => (
        <TaskCard key={task.id} task={task} navigate={navigate} />
      ))}
    </div>
  );
}

/* ─── Week View ─── */
function WeekView({ tasks, currentDate, navigate, onSelectDay }: { tasks: Task[]; currentDate: Date; navigate: (path: string) => void; onSelectDay: (d: Date) => void }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayTasks = tasks.filter((t) => t.scheduled_date === dayStr);
        const today = isToday(day);

        return (
          <div key={dayStr}>
            <button
              onClick={() => onSelectDay(day)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                today ? "bg-primary/10 text-primary" : "bg-muted/50 text-foreground"
              )}
            >
              <span className="capitalize">{format(day, "EEEE d", { locale: fr })}</span>
              {dayTasks.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{dayTasks.length}</Badge>
              )}
            </button>
            {dayTasks.length > 0 && (
              <div className="mt-1.5 space-y-1.5 pl-1">
                {dayTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/mobile/tache/${task.id}`)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border bg-card cursor-pointer active:scale-[0.98] transition-transform"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary">{task.start_time?.slice(0, 5)}</span>
                        <span className="text-xs text-muted-foreground">{task.duration_minutes}min</span>
                      </div>
                      <div className="font-medium text-sm truncate">{task.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{task.clients?.name}</div>
                    </div>
                    <Badge className={cn("text-[9px] shrink-0", INTERVENTION_TYPE_COLORS[task.intervention_type])}>
                      {INTERVENTION_TYPE_LABELS[task.intervention_type]?.split(" ").pop()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Month View ─── */
function MonthView({ tasks, currentDate, onSelectDay }: { tasks: Task[]; currentDate: Date; onSelectDay: (d: Date) => void }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const tasksByDate = useMemo(() => {
    const map: Record<string, number> = {};
    tasks.forEach((t) => {
      map[t.scheduled_date] = (map[t.scheduled_date] || 0) + 1;
    });
    return map;
  }, [tasks]);

  const dayNames = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((d, i) => (
          <div key={i} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {allDays.map((day) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const count = tasksByDate[dayStr] || 0;
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <button
              key={dayStr}
              onClick={() => onSelectDay(day)}
              className={cn(
                "aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors relative",
                !inMonth && "text-muted-foreground/40",
                inMonth && "text-foreground",
                today && "ring-2 ring-primary font-bold",
                count > 0 && inMonth && "bg-primary/10"
              )}
            >
              <span>{format(day, "d")}</span>
              {count > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <div key={i} className="w-1 h-1 rounded-full bg-primary" />
                  ))}
                  {count > 3 && <span className="text-[8px] text-primary font-bold">+</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day tasks summary */}
      {(() => {
        const dayStr = format(currentDate, "yyyy-MM-dd");
        const dayTasks = tasks.filter((t) => t.scheduled_date === dayStr);
        if (dayTasks.length === 0) return null;
        return (
          <div className="mt-3 space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground capitalize px-1">
              {format(currentDate, "EEEE d MMMM", { locale: fr })} · {dayTasks.length} tâche(s)
            </div>
            {dayTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/50 text-sm">
                <span className="font-bold text-primary text-xs">{t.start_time?.slice(0, 5)}</span>
                <span className="truncate flex-1">{t.title}</span>
                <span className="text-xs text-muted-foreground">{t.clients?.name}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

/* ─── Task Card (Day view) ─── */
function TaskCard({ task, navigate }: { task: Task; navigate: (path: string) => void }) {
  return (
    <Card
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

        {task.description && <div className="text-sm text-muted-foreground">{task.description}</div>}

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
              <div className="p-1 rounded bg-secondary/10">
                <Package className="w-3.5 h-3.5 text-secondary" />
              </div>
            )}
          </div>
        </div>

        {task.material_needed && (
          <div className="text-xs bg-muted rounded-md px-2 py-1">
            🔧 {task.material_needed}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {task.clients?.phone && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `tel:${task.clients!.phone}`;
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
  );
}
