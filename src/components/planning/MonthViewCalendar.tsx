import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { INTERVENTION_TYPE_COLORS, INTERVENTION_TYPE_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle2, Package } from "lucide-react";

interface MonthViewCalendarProps {
  currentDate: Date;
  tasks: any[];
  onTaskClick: (task: any) => void;
  onDayClick: (date: Date) => void;
}

export default function MonthViewCalendar({ currentDate, tasks, onTaskClick, onDayClick }: MonthViewCalendarProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  const getTasksForDay = (d: Date) => {
    const dateStr = format(d, "yyyy-MM-dd");
    return tasks.filter((t) => t.scheduled_date === dateStr);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Day names header */}
      <div className="grid grid-cols-7 bg-muted">
        {dayNames.map((name) => (
          <div key={name} className="p-2 text-center text-sm font-semibold text-muted-foreground border-b border-border">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((d) => {
            const dayTasks = getTasksForDay(d);
            const inMonth = isSameMonth(d, currentDate);
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  "border-b border-r border-border min-h-[100px] p-1 cursor-pointer transition-colors hover:bg-muted/50",
                  !inMonth && "bg-muted/30",
                  isToday(d) && "bg-primary/5"
                )}
                onClick={() => onDayClick(d)}
              >
                <div className={cn(
                  "text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full",
                  isToday(d) && "bg-primary text-primary-foreground",
                  !inMonth && "text-muted-foreground/50"
                )}>
                  {format(d, "d")}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs truncate cursor-pointer",
                        INTERVENTION_TYPE_COLORS[task.intervention_type] || "badge-autre"
                      )}
                    >
                      <span className="font-medium">{task.start_time?.slice(0, 5)}</span>{" "}
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-1">
                      +{dayTasks.length - 3} autre{dayTasks.length - 3 > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
