import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, MessageSquare, CheckCircle2, Package } from "lucide-react";
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, startOfMonth, addMonths, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS, TASK_STATUS_LABELS } from "@/lib/constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import CreateTaskDialog from "@/components/planning/CreateTaskDialog";
import TaskDetailDialog from "@/components/planning/TaskDetailDialog";
import WeekViewGrid from "@/components/planning/WeekViewGrid";
import MonthViewCalendar from "@/components/planning/MonthViewCalendar";
import { toast } from "sonner";

type ViewMode = "day" | "week" | "month";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 6); // 6h - 18h

const ALL_INTERVENTION_TYPES = Object.keys(INTERVENTION_TYPE_LABELS);

export default function Planning() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [tasks, setTasks] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [clickContext, setClickContext] = useState<{ hour?: number; workerId?: string }>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshTasks = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Detail dialog
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // Drag state
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, worker_level")
        .eq("is_active", true);
      setWorkers(data ?? []);
    };
    fetchWorkers();
  }, []);

  useEffect(() => {
    const fetchTasks = async () => {
      if (viewMode === "day") {
        const dateFilter = format(currentDate, "yyyy-MM-dd");
        const { data } = await supabase
          .from("work_tasks")
          .select("*, clients(name), client_sites(address), profiles!work_tasks_assigned_to_fkey(full_name)")
          .eq("scheduled_date", dateFilter);
        setTasks(data ?? []);
      } else if (viewMode === "week") {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = addDays(start, 6);
        const { data } = await supabase
          .from("work_tasks")
          .select("*, clients(name), client_sites(address), profiles!work_tasks_assigned_to_fkey(full_name)")
          .gte("scheduled_date", format(start, "yyyy-MM-dd"))
          .lte("scheduled_date", format(end, "yyyy-MM-dd"));
        setTasks(data ?? []);
      } else {
        const start = startOfMonth(currentDate);
        const end = addMonths(start, 1);
        const { data } = await supabase
          .from("work_tasks")
          .select("*, clients(name), client_sites(address), profiles!work_tasks_assigned_to_fkey(full_name)")
          .gte("scheduled_date", format(start, "yyyy-MM-dd"))
          .lt("scheduled_date", format(end, "yyyy-MM-dd"));
        setTasks(data ?? []);
      }
    };
    fetchTasks();
  }, [currentDate, viewMode, refreshKey]);

  const navigate = (direction: "prev" | "next") => {
    const fn = direction === "next"
      ? viewMode === "day" ? addDays : viewMode === "week" ? addWeeks : addMonths
      : viewMode === "day" ? subDays : viewMode === "week" ? subWeeks : subMonths;
    setCurrentDate((d) => fn(d, 1));
  };

  const dateLabel = viewMode === "day"
    ? format(currentDate, "EEEE d MMMM yyyy", { locale: fr })
    : viewMode === "week"
    ? `Semaine du ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: fr })}`
    : format(currentDate, "MMMM yyyy", { locale: fr });

  // --- Drag & Drop handlers ---
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(cellKey);
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = async (e: React.DragEvent, hour: number, workerId: string) => {
    e.preventDefault();
    setDragOverCell(null);
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;

    const newTime = `${String(hour).padStart(2, "0")}:00`;
    const { error } = await supabase.from("work_tasks").update({
      assigned_to: workerId,
      start_time: newTime,
    }).eq("id", taskId);

    if (error) {
      toast.error("Erreur lors du déplacement");
      return;
    }
    toast.success("Tâche déplacée");
    refreshTasks();
  };

  const filteredTasks = hiddenTypes.size > 0
    ? tasks.filter((t) => !hiddenTypes.has(t.intervention_type))
    : tasks;

  const toggleType = (type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planning</h1>
          <p className="text-muted-foreground capitalize">{dateLabel}</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Filter className="w-4 h-4" />
                {hiddenTypes.size > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                    {hiddenTypes.size}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 bg-popover z-50" align="end">
              <div className="text-sm font-semibold mb-2 px-2">Filtrer par type</div>
              {ALL_INTERVENTION_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                  <Checkbox
                    checked={!hiddenTypes.has(type)}
                    onCheckedChange={() => toggleType(type)}
                  />
                  <span className={cn("w-2 h-2 rounded-full", INTERVENTION_TYPE_COLORS[type])} />
                  {INTERVENTION_TYPE_LABELS[type]}
                </label>
              ))}
              {hiddenTypes.size > 0 && (
                <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setHiddenTypes(new Set())}>
                  Tout afficher
                </Button>
              )}
            </PopoverContent>
          </Popover>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  viewMode === mode ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {mode === "day" ? "Jour" : mode === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => navigate("prev")}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Aujourd'hui
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate("next")}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <CreateTaskDialog
            defaultDate={currentDate}
            defaultHour={clickContext.hour}
            defaultWorkerId={clickContext.workerId}
            onCreated={refreshTasks}
          />
        </div>
      </div>

      {/* Planning Grid - Day View */}
      {viewMode === "day" && (
        <div className="border border-border rounded-lg overflow-auto bg-card">
          <div className="grid" style={{ gridTemplateColumns: `60px repeat(${Math.max(workers.length, 1)}, minmax(180px, 1fr))` }}>
            {/* Header row */}
            <div className="sticky top-0 bg-muted border-b border-border p-2 text-xs font-medium text-muted-foreground z-10" />
            {workers.map((w) => (
              <div key={w.id} className="sticky top-0 bg-muted border-b border-l border-border p-2 text-sm font-semibold z-10 truncate">
                {w.full_name}
                {w.worker_level && (
                  <Badge variant="outline" className="ml-1 text-xs">{w.worker_level}</Badge>
                )}
              </div>
            ))}

            {/* Time rows */}
            {HOURS.map((hour) => (
              <div key={`row-${hour}`} className="contents">
                <div className="border-b border-border p-1 text-xs text-muted-foreground text-right pr-2 h-16 flex items-start justify-end pt-1">
                  {hour}:00
                </div>
                {workers.map((w) => {
                  const cellKey = `${hour}-${w.id}`;
                  const hourTasks = filteredTasks.filter(
                    (t) => t.assigned_to === w.id && t.start_time && parseInt(t.start_time.split(":")[0]) === hour
                  );
                  return (
                    <div
                      key={`cell-${cellKey}`}
                      className={cn(
                        "border-b border-l border-border h-16 p-0.5 relative cursor-pointer transition-colors",
                        dragOverCell === cellKey ? "bg-primary/10" : "hover:bg-muted/50"
                      )}
                      onClick={() => {
                        if (hourTasks.length > 0) return; // don't create if tasks exist
                        setClickContext({ hour, workerId: w.id });
                        setTimeout(() => {
                          document.querySelector<HTMLButtonElement>('[data-create-task-trigger]')?.click();
                        }, 0);
                      }}
                      onDragOver={(e) => handleDragOver(e, cellKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, hour, w.id)}
                    >
                      {hourTasks.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            handleDragStart(e, task.id);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                          }}
                          className={cn(
                            "absolute inset-x-0.5 rounded-md px-1.5 py-0.5 text-xs cursor-grab active:cursor-grabbing overflow-hidden z-[1] select-none",
                            INTERVENTION_TYPE_COLORS[task.intervention_type] || "badge-autre"
                          )}
                          style={{
                            height: `${Math.max((task.duration_minutes / 60) * 64, 20)}px`,
                          }}
                        >
                          <div className="font-semibold truncate">{task.title}</div>
                          <div className="truncate opacity-80">{task.clients?.name}</div>
                          <div className="flex gap-1 mt-0.5">
                            {task.memo_secretariat && <MessageSquare className="w-3 h-3" />}
                            {task.status === "termine" && <CheckCircle2 className="w-3 h-3" />}
                            {task.status === "piece_a_commander" && <Package className="w-3 h-3" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week View - Grid */}
      {viewMode === "week" && (
        <WeekViewGrid
          currentDate={currentDate}
          tasks={filteredTasks}
          workers={workers}
          onTaskClick={(task) => setSelectedTask(task)}
          onCellClick={(date, hour, workerId) => {
            setClickContext({ hour, workerId });
            setCurrentDate(date);
            setTimeout(() => {
              document.querySelector<HTMLButtonElement>('[data-create-task-trigger]')?.click();
            }, 0);
          }}
          onRefresh={refreshTasks}
        />
      )}

      {/* Month - Calendar view */}
      {viewMode === "month" && (
        <MonthViewCalendar
          currentDate={currentDate}
          tasks={filteredTasks}
          onTaskClick={(task) => setSelectedTask(task)}
          onDayClick={(date) => {
            setCurrentDate(date);
            setViewMode("day");
          }}
          onRefresh={refreshTasks}
        />
      )}

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdated={() => {
          setSelectedTask(null);
          refreshTasks();
        }}
      />
    </div>
  );
}
