import { useEffect, useState, useCallback, useMemo } from "react";
import { useDragScroll } from "@/hooks/useDragScroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Filter, ClipboardPaste, Users } from "lucide-react";
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, startOfMonth, addMonths, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS, FILTER_TYPE_GROUPS } from "@/lib/constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import CreateTaskDialog from "@/components/planning/CreateTaskDialog";
import TaskDetailDialog from "@/components/planning/TaskDetailDialog";
import WeekViewGrid from "@/components/planning/WeekViewGrid";
import MonthViewCalendar from "@/components/planning/MonthViewCalendar";
import DraggableTaskCard from "@/components/planning/DraggableTaskCard";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TaskClipboardProvider, useTaskClipboard } from "@/components/planning/TaskClipboardContext";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu";
import { useAuth } from "@/hooks/useAuth";
import { getOverlappingTaskIds, findOverlaps } from "@/lib/overlapUtils";

type ViewMode = "day" | "week" | "month";

const HOURS = Array.from({ length: 11 }, (_, i) => i + 7); // 7h - 17h
const ALL_FILTER_GROUPS = FILTER_TYPE_GROUPS;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Planning() {
  return (
    <TaskClipboardProvider>
      <PlanningInner />
    </TaskClipboardProvider>
  );
}

function PlanningInner() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [tasks, setTasks] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [visibleWorkerIds, setVisibleWorkerIds] = useState<Set<string> | null>(null); // null = all visible
  const [clickContext, setClickContext] = useState<{ hour?: number; workerId?: string }>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshTasks = useCallback(() => setRefreshKey((k) => k + 1), []);
  const { copiedTask, clearClipboard } = useTaskClipboard();

  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const dragScrollRef = useDragScroll();

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
          .select("*, clients(name, phone, address_intervention), client_sites(address), profiles!work_tasks_assigned_to_fkey(full_name)")
          .eq("scheduled_date", dateFilter);
        setTasks(data ?? []);
      } else if (viewMode === "week") {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = addDays(start, 6);
        const { data } = await supabase
          .from("work_tasks")
          .select("*, clients(name, phone, address_intervention), client_sites(address), profiles!work_tasks_assigned_to_fkey(full_name)")
          .gte("scheduled_date", format(start, "yyyy-MM-dd"))
          .lte("scheduled_date", format(end, "yyyy-MM-dd"));
        setTasks(data ?? []);
      } else {
        const start = startOfMonth(currentDate);
        const end = addMonths(start, 1);
        const { data } = await supabase
          .from("work_tasks")
          .select("*, clients(name, phone, address_intervention), client_sites(address), profiles!work_tasks_assigned_to_fkey(full_name)")
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

  const handleDrop = async (e: React.DragEvent, hour: number, quarter: number, workerId: string) => {
    e.preventDefault();
    setDragOverCell(null);
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;

    const minutes = quarter * 15;
    const newTime = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const droppedTask = tasks.find((t) => t.id === taskId);
    const duration = droppedTask?.duration_minutes ?? 60;
    const dateStr = format(currentDate, "yyyy-MM-dd");

    const conflicts = findOverlaps(workerId, dateStr, newTime, duration, tasks, taskId);
    if (conflicts.length > 0) {
      toast.warning("⚠️ Chevauchement détecté avec une autre tâche !");
    }

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

  const handlePaste = async (hour: number, quarter: number, workerId: string, date?: Date) => {
    if (!copiedTask || !user) return;
    const minutes = quarter * 15;
    const newTime = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const targetDate = format(date || currentDate, "yyyy-MM-dd");

    const conflicts = findOverlaps(workerId, targetDate, newTime, copiedTask.duration_minutes ?? 60, tasks);
    if (conflicts.length > 0) {
      toast.warning("⚠️ Chevauchement détecté avec une autre tâche !");
    }

    const { error } = await supabase.from("work_tasks").insert([{
      ...copiedTask,
      assigned_to: workerId,
      start_time: newTime,
      scheduled_date: targetDate,
      created_by: user.id,
      status: "planifie" as const,
    }]);
    if (error) {
      toast.error("Erreur lors du collage");
      return;
    }
    toast.success("Tâche collée");
    clearClipboard();
    refreshTasks();
  };

  const filteredTasks = hiddenTypes.size > 0
    ? tasks.filter((t) => !hiddenTypes.has(t.intervention_type))
    : tasks;

  const displayedWorkers = useMemo(
    () => visibleWorkerIds ? workers.filter((w) => visibleWorkerIds.has(w.id)) : workers,
    [workers, visibleWorkerIds]
  );

  const toggleWorker = (id: string) => {
    setVisibleWorkerIds((prev) => {
      if (!prev) {
        // First click: show only this worker
        const allIds = new Set(workers.map((w) => w.id));
        allIds.delete(id);
        // Actually, toggle means deselect this one → show all except this
        // Better UX: unchecking one means filter to all others
        const next = new Set(workers.map((w) => w.id));
        next.delete(id);
        return next;
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // If all selected again, reset to null
      if (next.size === workers.length) return null;
      if (next.size === 0) return null; // prevent empty
      return next;
    });
  };
  const overlappingIds = useMemo(() => getOverlappingTaskIds(filteredTasks), [filteredTasks]);

  const toggleGroup = (group: typeof ALL_FILTER_GROUPS[number]) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      const allHidden = group.types.every((t) => next.has(t));
      if (allHidden) {
        group.types.forEach((t) => next.delete(t));
      } else {
        group.types.forEach((t) => next.add(t));
      }
      return next;
    });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold">Planning</h1>
        <p className="text-muted-foreground text-sm">Gérez le planning de vos équipes</p>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                viewMode === mode ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {mode === "day" ? "Jour" : mode === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>

        {/* Type filter dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Tous types
              {hiddenTypes.size > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {hiddenTypes.size}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 bg-popover z-50" align="start">
            <div className="text-sm font-semibold mb-2 px-2">Filtrer par type</div>
            {ALL_FILTER_GROUPS.map((group) => {
              const allVisible = group.types.every((t) => !hiddenTypes.has(t));
              const someVisible = group.types.some((t) => !hiddenTypes.has(t));
              return (
                <label key={group.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                  <Checkbox
                    checked={allVisible}
                    {...(!allVisible && someVisible ? { "data-state": "indeterminate" } : {})}
                    onCheckedChange={() => toggleGroup(group)}
                  />
                  <span className={cn("w-2.5 h-2.5 rounded-full", INTERVENTION_TYPE_COLORS[group.types[0]])} />
                  {group.label}
                </label>
              );
            })}
            {hiddenTypes.size > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setHiddenTypes(new Set())}>
                Tout afficher
              </Button>
            )}
          </PopoverContent>
        </Popover>

        {/* Worker filter dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Users className="w-4 h-4" />
              {visibleWorkerIds ? `${visibleWorkerIds.size} ouvrier${visibleWorkerIds.size > 1 ? "s" : ""}` : "Tous ouvriers"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 bg-popover z-50" align="start">
            <div className="text-sm font-semibold mb-2 px-2">Filtrer par ouvrier</div>
            {workers.map((w) => (
              <label key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox
                  checked={!visibleWorkerIds || visibleWorkerIds.has(w.id)}
                  onCheckedChange={() => toggleWorker(w.id)}
                />
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                    {getInitials(w.full_name)}
                  </AvatarFallback>
                </Avatar>
                {w.full_name}
              </label>
            ))}
            {visibleWorkerIds && (
              <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setVisibleWorkerIds(null)}>
                Tous afficher
              </Button>
            )}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Action buttons */}
        <CreateTaskDialog
          defaultDate={currentDate}
          defaultHour={clickContext.hour}
          defaultWorkerId={clickContext.workerId}
          onCreated={refreshTasks}
        />
      </div>

      {/* Navigation row */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate("prev")}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => navigate("next")}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <span className="text-base font-semibold capitalize">{dateLabel}</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
          Aujourd'hui
        </Button>
      </div>

      {/* Planning Grid - Day View */}
      {viewMode === "day" && (
        <div ref={dragScrollRef} className="border border-border rounded-xl overflow-auto bg-card shadow-sm cursor-grab">
          <div className="grid" style={{ gridTemplateColumns: `80px repeat(${Math.max(displayedWorkers.length, 1)}, 180px)`, minWidth: `${80 + Math.max(displayedWorkers.length, 1) * 180}px` }}>
            {/* Header row - worker avatars */}
            <div className="sticky top-0 bg-muted/50 border-b border-border p-3 z-10" />
            {displayedWorkers.map((w) => (
              <div key={w.id} className="sticky top-0 bg-muted/50 border-b border-l border-border p-3 z-10 flex flex-col items-center gap-1.5">
                <Avatar className="h-9 w-9 bg-muted-foreground/20">
                  <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                    {getInitials(w.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-center truncate w-full">{w.full_name}</span>
              </div>
            ))}

            {/* Time rows */}
            {HOURS.map((hour) => (
              <div key={`row-${hour}`} className="contents">
                <div className="border-b border-border p-1 text-xs text-muted-foreground text-right pr-2 h-16 flex items-start justify-end pt-1 font-medium">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {displayedWorkers.map((w) => {
                  const hourTasks = filteredTasks.filter(
                    (t) => t.assigned_to === w.id && t.start_time && parseInt(t.start_time.split(":")[0]) === hour
                  );
                  return (
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          key={`cell-${hour}-${w.id}`}
                          className="border-b border-l border-border h-16 relative"
                        >
                          {/* 4 quarter-hour drop zones */}
                          {[0, 1, 2, 3].map((q) => {
                            const qKey = `${hour}-${q}-${w.id}`;
                            return (
                              <div
                                key={qKey}
                                className={cn(
                                  "absolute inset-x-0 cursor-pointer transition-colors",
                                  q < 3 && "border-b border-dashed border-border/30",
                                  dragOverCell === qKey ? "bg-primary/10" : "hover:bg-muted/20"
                                )}
                                style={{ top: `${q * 25}%`, height: "25%" }}
                                onClick={() => {
                                  if (hourTasks.length > 0) return;
                                  setClickContext({ hour, workerId: w.id });
                                  setTimeout(() => {
                                    document.querySelector<HTMLButtonElement>('[data-create-task-trigger]')?.click();
                                  }, 0);
                                }}
                                onDragOver={(e) => handleDragOver(e, qKey)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, hour, q, w.id)}
                              />
                            );
                          })}
                      {/* Task cards */}
                      {hourTasks.map((task) => {
                        const startMin = parseInt(task.start_time.split(":")[1] || "0");
                        const topOffset = (startMin / 60) * 64;
                        return (
                          <div key={task.id} className="absolute inset-x-1 z-[2]" style={{ top: `${topOffset}px` }}>
                            <DraggableTaskCard
                              task={task}
                              onDragStart={handleDragStart}
                              onClick={setSelectedTask}
                              onResized={refreshTasks}
                              hasOverlap={overlappingIds.has(task.id)}
                            />
                          </div>
                        );
                      })}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem
                          disabled={!copiedTask}
                          onClick={() => handlePaste(hour, 0, w.id)}
                          className="gap-2"
                        >
                          <ClipboardPaste className="w-4 h-4" />
                          Coller la tâche
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === "week" && (
        <WeekViewGrid
          currentDate={currentDate}
          tasks={filteredTasks}
          workers={displayedWorkers}
          onTaskClick={(task) => setSelectedTask(task)}
          onCellClick={(date, hour, workerId) => {
            setClickContext({ hour, workerId });
            setCurrentDate(date);
            setTimeout(() => {
              document.querySelector<HTMLButtonElement>('[data-create-task-trigger]')?.click();
            }, 0);
          }}
          onRefresh={refreshTasks}
          onPaste={handlePaste}
        />
      )}

      {/* Month View */}
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
