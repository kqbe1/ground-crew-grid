import { useState, useRef } from "react";
import { format, startOfWeek, addDays, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import PlanningHorizontalGrid from "@/components/planning/PlanningHorizontalGrid";

interface WeekViewGridProps {
  currentDate: Date;
  tasks: any[];
  workers: any[];
  onTaskClick: (task: any) => void;
  onCellClick: (date: Date, hour: number, minute: number, workerId: string, durationMinutes?: number) => void;
  onRefresh: () => void;
  onWorkerReorder: (draggedId: string, targetId: string) => void;
  onPaste?: (hour: number, quarter: number, workerId: string, date?: Date) => void;
}

export default function WeekViewGrid({
  currentDate, tasks, workers, onTaskClick, onCellClick, onRefresh, onWorkerReorder, onPaste,
}: WeekViewGridProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayIdx = days.findIndex((d) => isToday(d));
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIdx >= 0 ? todayIdx : 0);

  const selectedDay = days[selectedDayIndex];

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border border-border rounded-xl p-1.5 bg-muted/30 overflow-x-auto">
        {days.map((day, i) => {
          const dayTaskCount = tasks.filter((t) => t.scheduled_date === format(day, "yyyy-MM-dd")).length;
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDayIndex(i)}
              className={cn(
                "flex-1 min-w-[80px] px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-center",
                selectedDayIndex === i ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted",
                isToday(day) && selectedDayIndex !== i && "ring-1 ring-primary/50"
              )}
            >
              <div className="capitalize text-xs">{format(day, "EEE", { locale: fr })}</div>
              <div className={cn("text-lg leading-tight", isToday(day) && "font-bold")}>{format(day, "d")}</div>
              {dayTaskCount > 0 && (
                <div className={cn("text-[10px] mt-0.5", selectedDayIndex === i ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {dayTaskCount} tâche{dayTaskCount > 1 ? "s" : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <PlanningHorizontalGrid
        date={selectedDay}
        tasks={tasks}
        workers={workers}
        onTaskClick={onTaskClick}
        onCellClick={(h, m, wid, dur) => onCellClick(selectedDay, h, m, wid, dur)}
        onRefresh={onRefresh}
        onWorkerReorder={onWorkerReorder}
        onPaste={onPaste ? (h, q, wid) => onPaste(h, q, wid, selectedDay) : undefined}
      />
    </div>
  );
}
