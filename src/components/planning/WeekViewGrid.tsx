import { useState, useRef } from "react";
import { useDragScroll } from "@/hooks/useDragScroll";
import { format, startOfWeek, addDays, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { INTERVENTION_TYPE_COLORS, INTERVENTION_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import DraggableTaskCard from "@/components/planning/DraggableTaskCard";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu";
import { useTaskClipboard } from "@/components/planning/TaskClipboardContext";
import { ClipboardPaste } from "lucide-react";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 6);

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface WeekViewGridProps {
  currentDate: Date;
  tasks: any[];
  workers: any[];
  onTaskClick: (task: any) => void;
  onCellClick: (date: Date, hour: number, workerId?: string) => void;
  onRefresh: () => void;
  onPaste?: (hour: number, quarter: number, workerId: string, date?: Date) => void;
}

export default function WeekViewGrid({ currentDate, tasks, workers, onTaskClick, onCellClick, onRefresh, onPaste }: WeekViewGridProps) {
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const { copiedTask } = useTaskClipboard();
  const dragScrollRef = useDragScroll();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const todayInWeek = days.find((d) => isToday(d));
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    if (todayInWeek) return days.findIndex((d) => isToday(d));
    return 0;
  });

  const selectedDay = days[selectedDayIndex];
  const selectedDateStr = format(selectedDay, "yyyy-MM-dd");
  const dayTasks = tasks.filter((t) => t.scheduled_date === selectedDateStr);

  // When dragging over a day tab, auto-switch to that day after a short delay
  const dragSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDayDragEnter = (dayIndex: number) => {
    setDragOverDay(dayIndex);
    if (dragSwitchTimerRef.current) clearTimeout(dragSwitchTimerRef.current);
    dragSwitchTimerRef.current = setTimeout(() => {
      setSelectedDayIndex(dayIndex);
    }, 400);
  };

  const handleDayDragLeave = () => {
    setDragOverDay(null);
    if (dragSwitchTimerRef.current) clearTimeout(dragSwitchTimerRef.current);
  };

  const handleDayDrop = async (e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    setDragOverDay(null);
    if (dragSwitchTimerRef.current) clearTimeout(dragSwitchTimerRef.current);
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;

    const targetDate = format(days[dayIndex], "yyyy-MM-dd");
    const { error } = await supabase.from("work_tasks").update({
      scheduled_date: targetDate,
    }).eq("id", taskId);

    if (error) {
      toast.error("Erreur lors du déplacement");
      return;
    }
    setSelectedDayIndex(dayIndex);
    toast.success("Tâche déplacée au " + format(days[dayIndex], "EEEE d", { locale: fr }));
    onRefresh();
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent, hour: number, quarter: number, workerId: string) => {
    e.preventDefault();
    setDragOverCell(null);
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;

    const minutes = quarter * 15;
    const newTime = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const { error } = await supabase.from("work_tasks").update({
      assigned_to: workerId,
      start_time: newTime,
      scheduled_date: selectedDateStr,
    }).eq("id", taskId);

    if (error) {
      toast.error("Erreur lors du déplacement");
      return;
    }
    toast.success("Tâche déplacée");
    onRefresh();
  };

  return (
    <div className="space-y-3">
      {/* Day tabs */}
      <div className="flex gap-1 border border-border rounded-xl p-1.5 bg-muted/30 overflow-x-auto">
        {days.map((day, i) => {
          const dayTaskCount = tasks.filter((t) => t.scheduled_date === format(day, "yyyy-MM-dd")).length;
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDayIndex(i)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDragEnter={() => handleDayDragEnter(i)}
              onDragLeave={handleDayDragLeave}
              onDrop={(e) => handleDayDrop(e, i)}
              className={cn(
                "flex-1 min-w-[80px] px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-center",
                selectedDayIndex === i
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-muted",
                isToday(day) && selectedDayIndex !== i && "ring-1 ring-primary/50",
                dragOverDay === i && selectedDayIndex !== i && "ring-2 ring-primary bg-primary/10"
              )}
            >
              <div className="capitalize text-xs">{format(day, "EEE", { locale: fr })}</div>
              <div className={cn("text-lg leading-tight", isToday(day) && "font-bold")}>
                {format(day, "d")}
              </div>
              {dayTaskCount > 0 && (
                <div className={cn(
                  "text-[10px] mt-0.5",
                  selectedDayIndex === i ? "text-primary-foreground/80" : "text-muted-foreground"
                )}>
                  {dayTaskCount} tâche{dayTaskCount > 1 ? "s" : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Worker columns grid */}
      <div ref={dragScrollRef} className="border border-border rounded-xl overflow-auto bg-card shadow-sm cursor-grab">
        <div className="grid" style={{ gridTemplateColumns: `80px repeat(${Math.max(workers.length, 1)}, 180px)`, minWidth: `${80 + Math.max(workers.length, 1) * 180}px` }}>
          {/* Header row - worker avatars */}
          <div className="sticky top-0 bg-muted/50 border-b border-border p-3 z-10" />
          {workers.map((w) => (
            <div key={w.id} className="sticky top-0 bg-muted/50 border-b border-l border-border p-3 z-10 flex flex-col items-center gap-1.5">
              <Avatar className="h-9 w-9">
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
              <div className="border-b border-border p-2 text-sm text-muted-foreground text-right pr-3 h-24 flex items-start justify-end pt-2 font-medium">
                {String(hour).padStart(2, "0")}:00
              </div>
              {workers.map((w) => {
                const hourTasks = dayTasks.filter(
                  (t) => t.assigned_to === w.id && t.start_time && parseInt(t.start_time.split(":")[0]) === hour
                );
                return (
                  <ContextMenu key={`cell-${hour}-${w.id}`}>
                    <ContextMenuTrigger asChild>
                      <div
                        className="border-b border-l border-border h-24 relative"
                      >
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
                                onCellClick(selectedDay, hour, w.id);
                              }}
                              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCell(qKey); }}
                              onDragLeave={() => setDragOverCell(null)}
                              onDrop={(e) => handleDrop(e, hour, q, w.id)}
                            />
                          );
                        })}
                        {hourTasks.map((task) => {
                          const startMin = parseInt(task.start_time.split(":")[1] || "0");
                          const topOffset = (startMin / 60) * 96;
                          return (
                            <div key={task.id} className="absolute inset-x-1 z-[2]" style={{ top: `${topOffset}px` }}>
                              <DraggableTaskCard
                                task={task}
                                onDragStart={handleDragStart}
                                onClick={onTaskClick}
                                onResized={onRefresh}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        disabled={!copiedTask || !onPaste}
                        onClick={() => onPaste?.(hour, 0, w.id, selectedDay)}
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
    </div>
  );
}
