import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Filter, Users, Calendar as CalendarIcon } from "lucide-react";
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, startOfMonth, addMonths, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { INTERVENTION_TYPE_COLORS, FILTER_TYPE_GROUPS } from "@/lib/constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import CreateTaskDialog from "@/components/planning/CreateTaskDialog";
import { useNavigate } from "react-router-dom";
import WeekViewGrid from "@/components/planning/WeekViewGrid";
import MonthViewCalendar from "@/components/planning/MonthViewCalendar";
import PlanningHorizontalGrid from "@/components/planning/PlanningHorizontalGrid";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TaskClipboardProvider, useTaskClipboard } from "@/components/planning/TaskClipboardContext";
import { useAuth } from "@/hooks/useAuth";
import { findOverlaps } from "@/lib/overlapUtils";
import LayoutPage from "@/components/layout/LayoutPage";

type ViewMode = "day" | "week" | "month";
const ALL_FILTER_GROUPS = FILTER_TYPE_GROUPS;

function workerLabel(index: number) {
  return `T${index + 1}`;
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
  const routerNavigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [tasks, setTasks] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [visibleWorkerIds, setVisibleWorkerIds] = useState<Set<string> | null>(null);
  const [clickContext, setClickContext] = useState<{ date?: Date; hour?: number; minute?: number; workerId?: string; duration?: number }>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshTasks = useCallback(() => setRefreshKey((k) => k + 1), []);
  const { copiedTask, clearClipboard } = useTaskClipboard();

  const openTaskDetail = (task: any) => routerNavigate(`/taches/${task.id}`);

  const fetchWorkers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, worker_level, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("full_name", { ascending: true });
    setWorkers(data ?? []);
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  useEffect(() => {
    const fetchTasks = async () => {
      const sel = "*, clients(name, phone, address_intervention), client_sites(address), profiles!work_tasks_assigned_to_fkey(full_name)";
      if (viewMode === "day") {
        const dateFilter = format(currentDate, "yyyy-MM-dd");
        const { data } = await supabase.from("work_tasks").select(sel).eq("scheduled_date", dateFilter);
        setTasks(data ?? []);
      } else if (viewMode === "week") {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = addDays(start, 6);
        const { data } = await supabase.from("work_tasks").select(sel)
          .gte("scheduled_date", format(start, "yyyy-MM-dd"))
          .lte("scheduled_date", format(end, "yyyy-MM-dd"));
        setTasks(data ?? []);
      } else {
        const start = startOfMonth(currentDate);
        const end = addMonths(start, 1);
        const { data } = await supabase.from("work_tasks").select(sel)
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

  const handlePaste = async (hour: number, quarter: number, workerId: string, date?: Date) => {
    if (!copiedTask || !user) return;
    const minutes = quarter * 15;
    const newTime = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const targetDate = format(date || currentDate, "yyyy-MM-dd");
    const conflicts = findOverlaps(workerId, targetDate, newTime, copiedTask.duration_minutes ?? 60, tasks);
    if (conflicts.length > 0) toast.warning("⚠️ Chevauchement détecté !");
    const { error } = await supabase.from("work_tasks").insert([{
      ...copiedTask as any,
      assigned_to: workerId, start_time: newTime, scheduled_date: targetDate,
      created_by: user.id, status: "planifie" as const,
    }]);
    if (error) { toast.error("Erreur collage"); return; }
    toast.success("Tâche collée");
    clearClipboard();
    refreshTasks();
  };

  const handleWorkerReorder = useCallback(async (draggedId: string, targetId: string) => {
    const list = [...workers];
    const fromIdx = list.findIndex((w) => w.id === draggedId);
    const toIdx = list.findIndex((w) => w.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    // Reassign sequential display_order
    const updates = list.map((w, i) => ({ id: w.id, display_order: i + 1 }));
    setWorkers(list.map((w, i) => ({ ...w, display_order: i + 1 })));
    // Persist
    const promises = updates.map((u) =>
      supabase.from("profiles").update({ display_order: u.display_order }).eq("id", u.id)
    );
    const results = await Promise.all(promises);
    if (results.some((r) => r.error)) {
      toast.error("Erreur lors de la sauvegarde de l'ordre");
      fetchWorkers();
    } else {
      toast.success("Ordre mis à jour");
    }
  }, [workers, fetchWorkers]);

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
        const next = new Set(workers.map((w) => w.id));
        next.delete(id);
        return next;
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === workers.length) return null;
      if (next.size === 0) return null;
      return next;
    });
  };

  const toggleGroup = (group: typeof ALL_FILTER_GROUPS[number]) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      const allHidden = group.types.every((t) => next.has(t));
      if (allHidden) group.types.forEach((t) => next.delete(t));
      else group.types.forEach((t) => next.add(t));
      return next;
    });
  };

  const handleCellClick = (date: Date, hour: number, minute: number, workerId: string, duration?: number) => {
    setClickContext({ date, hour, minute, workerId, duration });
    setCurrentDate(date);
    setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[data-create-task-trigger]')?.click();
    }, 0);
  };

  return (
    <LayoutPage
      icon={CalendarIcon}
      title="Planning"
      actions={
        <CreateTaskDialog
          defaultDate={clickContext.date ?? currentDate}
          defaultHour={clickContext.hour}
          defaultMinute={clickContext.minute}
          defaultWorkerId={clickContext.workerId}
          defaultDuration={clickContext.duration}
          onCreated={refreshTasks}
        />
      }
    >
      <div className="flex items-center gap-3 flex-wrap">
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

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" /> Tous types
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

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Users className="w-4 h-4" />
              {visibleWorkerIds ? `${visibleWorkerIds.size} ouvrier${visibleWorkerIds.size > 1 ? "s" : ""}` : "Tous ouvriers"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 bg-popover z-50" align="start">
            <div className="text-sm font-semibold mb-2 px-2">Filtrer par ouvrier</div>
            {workers.map((w, idx) => (
              <label key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox
                  checked={!visibleWorkerIds || visibleWorkerIds.has(w.id)}
                  onCheckedChange={() => toggleWorker(w.id)}
                />
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                    {workerLabel(idx)}
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
      </div>

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

      {viewMode === "day" && (
        <PlanningHorizontalGrid
          date={currentDate}
          tasks={filteredTasks}
          workers={displayedWorkers}
          onTaskClick={openTaskDetail}
          onCellClick={(h, m, wid, dur) => handleCellClick(currentDate, h, m, wid, dur)}
          onRefresh={refreshTasks}
          onWorkerReorder={handleWorkerReorder}
          onPaste={(h, q, wid) => handlePaste(h, q, wid)}
        />
      )}

      {viewMode === "week" && (
        <WeekViewGrid
          currentDate={currentDate}
          tasks={filteredTasks}
          workers={displayedWorkers}
          onTaskClick={openTaskDetail}
          onCellClick={handleCellClick}
          onRefresh={refreshTasks}
          onWorkerReorder={handleWorkerReorder}
          onPaste={handlePaste}
        />
      )}

      {viewMode === "month" && (
        <MonthViewCalendar
          currentDate={currentDate}
          tasks={filteredTasks}
          onTaskClick={openTaskDetail}
          onDayClick={(date) => { setCurrentDate(date); setViewMode("day"); }}
          onRefresh={refreshTasks}
        />
      )}
    </LayoutPage>
  );
}
