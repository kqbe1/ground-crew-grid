import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare, CheckCircle2, Package } from "lucide-react";
import { INTERVENTION_TYPE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 6);

interface WeekViewGridProps {
  currentDate: Date;
  tasks: any[];
  onTaskClick: (task: any) => void;
  onCellClick: (date: Date, hour: number) => void;
  onRefresh: () => void;
}

export default function WeekViewGrid({ currentDate, tasks, onTaskClick, onCellClick, onRefresh }: WeekViewGridProps) {
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(cellKey);
  };

  const handleDrop = async (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    setDragOverCell(null);
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;

    const newDate = format(day, "yyyy-MM-dd");
    const newTime = `${String(hour).padStart(2, "0")}:00`;
    const { error } = await supabase.from("work_tasks").update({
      scheduled_date: newDate,
      start_time: newTime,
    }).eq("id", taskId);

    if (error) {
      toast.error("Erreur lors du déplacement");
      return;
    }
    toast.success("Tâche déplacée");
    onRefresh();
  };

  const today = new Date();

  return (
    <div className="border border-border rounded-lg overflow-auto bg-card">
      <div className="grid" style={{ gridTemplateColumns: `60px repeat(7, minmax(140px, 1fr))` }}>
        {/* Header row */}
        <div className="sticky top-0 bg-muted border-b border-border p-2 text-xs font-medium text-muted-foreground z-10" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "sticky top-0 bg-muted border-b border-l border-border p-2 text-sm font-semibold z-10 text-center",
              isSameDay(day, today) && "bg-primary/10"
            )}
          >
            <div className="capitalize">{format(day, "EEE", { locale: fr })}</div>
            <div className={cn("text-lg", isSameDay(day, today) && "text-primary font-bold")}>
              {format(day, "d")}
            </div>
          </div>
        ))}

        {/* Time rows */}
        {HOURS.map((hour) => (
          <div key={`row-${hour}`} className="contents">
            <div className="border-b border-border p-1 text-xs text-muted-foreground text-right pr-2 h-16 flex items-start justify-end pt-1">
              {hour}:00
            </div>
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const cellKey = `${dateStr}-${hour}`;
              const cellTasks = tasks.filter(
                (t) => t.scheduled_date === dateStr && t.start_time && parseInt(t.start_time.split(":")[0]) === hour
              );
              return (
                <div
                  key={cellKey}
                  className={cn(
                    "border-b border-l border-border h-16 p-0.5 relative cursor-pointer transition-colors",
                    dragOverCell === cellKey ? "bg-primary/10" : "hover:bg-muted/50",
                    isSameDay(day, today) && "bg-primary/5"
                  )}
                  onClick={() => {
                    if (cellTasks.length > 0) return;
                    onCellClick(day, hour);
                  }}
                  onDragOver={(e) => handleDragOver(e, cellKey)}
                  onDragLeave={() => setDragOverCell(null)}
                  onDrop={(e) => handleDrop(e, day, hour)}
                >
                  {cellTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        handleDragStart(e, task.id);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick(task);
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
                      <div className="truncate opacity-80">{task.profiles?.full_name}</div>
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
  );
}
