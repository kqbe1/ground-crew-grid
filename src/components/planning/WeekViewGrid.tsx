import { useState } from "react";
import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare, CheckCircle2, Package } from "lucide-react";
import { INTERVENTION_TYPE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 6);

interface WeekViewGridProps {
  currentDate: Date;
  tasks: any[];
  workers: any[];
  onTaskClick: (task: any) => void;
  onCellClick: (date: Date, hour: number, workerId?: string) => void;
  onRefresh: () => void;
}

export default function WeekViewGrid({ currentDate, tasks, workers, onTaskClick, onCellClick, onRefresh }: WeekViewGridProps) {
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Selected day tab - default to today if in current week, otherwise Monday
  const todayInWeek = days.find((d) => isToday(d));
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    if (todayInWeek) return days.findIndex((d) => isToday(d));
    return 0;
  });

  const selectedDay = days[selectedDayIndex];
  const selectedDateStr = format(selectedDay, "yyyy-MM-dd");

  const dayTasks = tasks.filter((t) => t.scheduled_date === selectedDateStr);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
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
    <div className="space-y-2">
      {/* Day tabs */}
      <div className="flex gap-1 border border-border rounded-lg p-1 bg-muted/50 overflow-x-auto">
        {days.map((day, i) => {
          const dayTaskCount = tasks.filter((t) => t.scheduled_date === format(day, "yyyy-MM-dd")).length;
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDayIndex(i)}
              className={cn(
                "flex-1 min-w-[80px] px-3 py-2 rounded-md text-sm font-medium transition-colors text-center",
                selectedDayIndex === i
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-muted",
                isToday(day) && selectedDayIndex !== i && "ring-1 ring-primary/50"
              )}
            >
              <div className="capitalize">{format(day, "EEE", { locale: fr })}</div>
              <div className={cn("text-lg leading-tight", isToday(day) && "font-bold")}>
                {format(day, "d")}
              </div>
              {dayTaskCount > 0 && (
                <div className={cn(
                  "text-xs mt-0.5",
                  selectedDayIndex === i ? "text-primary-foreground/80" : "text-muted-foreground"
                )}>
                  {dayTaskCount} tâche{dayTaskCount > 1 ? "s" : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Worker columns grid (same as day view) */}
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
                const hourTasks = dayTasks.filter(
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
                      if (hourTasks.length > 0) return;
                      onCellClick(selectedDay, hour, w.id);
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCell(cellKey); }}
                    onDragLeave={() => setDragOverCell(null)}
                    onDrop={(e) => handleDrop(e, hour, w.id)}
                  >
                    {hourTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, task.id); }}
                        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
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
    </div>
  );
}
