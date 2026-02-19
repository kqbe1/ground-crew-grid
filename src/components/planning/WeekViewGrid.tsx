import { useState } from "react";
import { format, startOfWeek, addDays, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare, CheckCircle2, Package, Phone } from "lucide-react";
import { INTERVENTION_TYPE_COLORS, INTERVENTION_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
}

export default function WeekViewGrid({ currentDate, tasks, workers, onTaskClick, onCellClick, onRefresh }: WeekViewGridProps) {
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
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
    <div className="space-y-3">
      {/* Day tabs */}
      <div className="flex gap-1 border border-border rounded-xl p-1.5 bg-muted/30 overflow-x-auto">
        {days.map((day, i) => {
          const dayTaskCount = tasks.filter((t) => t.scheduled_date === format(day, "yyyy-MM-dd")).length;
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDayIndex(i)}
              className={cn(
                "flex-1 min-w-[80px] px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-center",
                selectedDayIndex === i
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-muted",
                isToday(day) && selectedDayIndex !== i && "ring-1 ring-primary/50"
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
      <div className="border border-border rounded-xl overflow-auto bg-card shadow-sm">
        <div className="grid" style={{ gridTemplateColumns: `80px repeat(${Math.max(workers.length, 1)}, minmax(160px, 1fr))` }}>
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
                const cellKey = `${hour}-${w.id}`;
                const hourTasks = dayTasks.filter(
                  (t) => t.assigned_to === w.id && t.start_time && parseInt(t.start_time.split(":")[0]) === hour
                );
                return (
                  <div
                    key={`cell-${cellKey}`}
                    className={cn(
                      "border-b border-l border-border h-24 p-1 relative cursor-pointer transition-colors",
                      dragOverCell === cellKey ? "bg-primary/10" : "hover:bg-muted/30"
                    )}
                    onClick={() => {
                      if (hourTasks.length > 0) return;
                      onCellClick(selectedDay, hour, w.id);
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCell(cellKey); }}
                    onDragLeave={() => setDragOverCell(null)}
                    onDrop={(e) => handleDrop(e, hour, w.id)}
                  >
                    {hourTasks.map((task) => {
                      const startH = parseInt(task.start_time.split(":")[0]);
                      const startM = parseInt(task.start_time.split(":")[1] || "0");
                      const endMinutes = (startH * 60 + startM) + task.duration_minutes;
                      const endHour = Math.floor(endMinutes / 60);
                      const endMin = endMinutes % 60;
                      const timeRange = `${task.start_time?.slice(0, 5)} – ${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, task.id); }}
                          onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                          className={cn(
                            "absolute inset-x-1 rounded-xl px-2.5 py-2 text-xs cursor-grab active:cursor-grabbing overflow-hidden z-[1] select-none border border-white/20 shadow-md flex flex-col gap-0.5",
                            INTERVENTION_TYPE_COLORS[task.intervention_type] || "badge-autre"
                          )}
                          style={{
                            height: `${Math.max((task.duration_minutes / 60) * 96, 80)}px`,
                          }}
                        >
                          <div className="font-bold truncate text-[13px] leading-tight">{task.title}</div>
                          <div className="font-semibold opacity-90 text-[11px]">{timeRange}</div>
                          {task.clients?.name && (
                            <div className="truncate opacity-90 text-[11px] mt-0.5">{task.clients.name}</div>
                          )}
                          {task.clients?.address_intervention && (
                            <div className="truncate opacity-75 text-[10px]">{task.clients.address_intervention}</div>
                          )}
                          {task.clients?.phone && (
                            <div className="truncate opacity-80 text-[10px] flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5 shrink-0" />
                              {task.clients.phone}
                            </div>
                          )}
                          <div className="flex items-center gap-1 mt-auto pt-0.5">
                            {task.memo_secretariat && <MessageSquare className="w-3 h-3 opacity-80" />}
                            {task.status === "termine" && <CheckCircle2 className="w-3 h-3 opacity-80" />}
                            {task.status === "piece_a_commander" && <Package className="w-3 h-3 opacity-80" />}
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-white/20 border-white/30 text-white ml-auto rounded-md font-semibold">
                              {INTERVENTION_TYPE_LABELS[task.intervention_type]?.split(" ").pop()}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
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
