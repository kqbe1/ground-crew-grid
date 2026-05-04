import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GripVertical, ClipboardPaste } from "lucide-react";
import DraggableTaskCard from "@/components/planning/DraggableTaskCard";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu";
import { useTaskClipboard } from "@/components/planning/TaskClipboardContext";
import { findOverlaps, getOverlappingTaskIds } from "@/lib/overlapUtils";

const HOURS = Array.from({ length: 11 }, (_, i) => i + 7);
const ROW_HEIGHT = 80;
const WORKER_COL_WIDTH = 200;
const MIN_HOUR_WIDTH = 80;

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface Props {
  date: Date;
  tasks: any[];
  workers: any[];
  onTaskClick: (task: any) => void;
  onCellClick: (hour: number, minute: number, workerId: string, durationMinutes?: number) => void;
  onRefresh: () => void;
  onWorkerReorder: (draggedId: string, targetId: string) => void;
  onPaste?: (hour: number, quarter: number, workerId: string) => void;
}

export default function PlanningHorizontalGrid({
  date, tasks, workers, onTaskClick, onCellClick, onRefresh, onWorkerReorder, onPaste,
}: Props) {
  const [dragOverWorker, setDragOverWorker] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ workerId: string; startMin: number; endMin: number } | null>(null);
  const selectingRef = useRef<{ workerId: string; startMin: number; rowEl: HTMLElement } | null>(null);
  const { copiedTask } = useTaskClipboard();
  const dateStr = format(date, "yyyy-MM-dd");
  const dayTasks = useMemo(() => tasks.filter((t) => t.scheduled_date === dateStr), [tasks, dateStr]);
  const overlappingIds = useMemo(() => getOverlappingTaskIds(dayTasks), [dayTasks]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [hourWidth, setHourWidth] = useState<number>(120);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const available = el.clientWidth - WORKER_COL_WIDTH;
      const w = Math.max(MIN_HOUR_WIDTH, Math.floor(available / HOURS.length));
      setHourWidth(w);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const xToMinutes = (x: number) => {
    const m = Math.round((x / hourWidth) * 60 / 15) * 15;
    return Math.max(0, Math.min(11 * 60, m)) + 7 * 60;
  };

  const handleRowPointerDown = (e: React.PointerEvent<HTMLDivElement>, workerId: string) => {
    if ((e.target as HTMLElement).closest("[data-task-card]")) return;
    if (e.button !== 0) return;
    const rowEl = e.currentTarget;
    const rect = rowEl.getBoundingClientRect();
    const startMin = xToMinutes(e.clientX - rect.left);
    selectingRef.current = { workerId, startMin, rowEl };
    setSelection({ workerId, startMin, endMin: startMin + 15 });
    rowEl.setPointerCapture(e.pointerId);
  };

  const handleRowPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!selectingRef.current) return;
    const { workerId, startMin, rowEl } = selectingRef.current;
    const rect = rowEl.getBoundingClientRect();
    const cur = xToMinutes(e.clientX - rect.left);
    const lo = Math.min(startMin, cur);
    const hi = Math.max(startMin + 15, cur + 15);
    setSelection({ workerId, startMin: lo, endMin: hi });
  };

  const handleRowPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!selectingRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const sel = selection;
    selectingRef.current = null;
    setSelection(null);
    if (!sel) return;
    const duration = sel.endMin - sel.startMin;
    const hour = Math.floor(sel.startMin / 60);
    const minute = sel.startMin % 60;
    onCellClick(hour, minute, sel.workerId, duration);
  };

  const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCellDrop = async (e: React.DragEvent, workerId: string) => {
    e.preventDefault();
    setDragOverCell(null);
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const totalMin = xToMinutes(e.clientX - rect.left);
    const newTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
    const droppedTask = tasks.find((t) => t.id === taskId);
    const duration = droppedTask?.duration_minutes ?? 60;
    const conflicts = findOverlaps(workerId, dateStr, newTime, duration, dayTasks, taskId);
    if (conflicts.length > 0) toast.warning("⚠️ Chevauchement détecté !");
    const { error } = await supabase.from("work_tasks").update({
      assigned_to: workerId, start_time: newTime, scheduled_date: dateStr,
    }).eq("id", taskId);
    if (error) { toast.error("Erreur déplacement"); return; }
    toast.success("Tâche déplacée");
    onRefresh();
  };

  const handleWorkerDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverWorker(null);
    const draggedId = e.dataTransfer.getData("workerId");
    if (!draggedId || draggedId === targetId) return;
    onWorkerReorder(draggedId, targetId);
  };

  const totalWidth = WORKER_COL_WIDTH + HOURS.length * hourWidth;

  return (
    <div ref={containerRef} className="border border-border rounded-xl overflow-auto bg-card shadow-sm w-full">
      <div style={{ minWidth: totalWidth }}>
        {/* Header: hours */}
        <div className="sticky top-0 z-20 flex bg-muted/50 border-b border-border">
          <div className="shrink-0 border-r border-border bg-muted/50" style={{ width: WORKER_COL_WIDTH }}>
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">Ouvriers</div>
          </div>
          {HOURS.map((h) => (
            <div
              key={h}
              className="shrink-0 border-r border-border text-xs font-medium text-muted-foreground py-2 text-center"
              style={{ width: hourWidth }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Rows */}
        {workers.map((w) => {
          const workerTasks = dayTasks.filter((t) => t.assigned_to === w.id);
          const isSelectingRow = selection?.workerId === w.id;
          return (
            <div
              key={w.id}
              className={cn(
                "flex border-b border-border relative",
                dragOverWorker === w.id && "bg-primary/5"
              )}
              style={{ height: ROW_HEIGHT }}
            >
              {/* Worker label */}
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("workerId", w.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("workerid") || e.dataTransfer.types.includes("workerId")) {
                    e.preventDefault();
                    setDragOverWorker(w.id);
                  }
                }}
                onDragLeave={() => setDragOverWorker(null)}
                onDrop={(e) => handleWorkerDrop(e, w.id)}
                className={cn(
                  "shrink-0 sticky left-0 z-10 border-r border-border bg-card flex items-center gap-2 px-3 cursor-grab active:cursor-grabbing",
                  dragOverWorker === w.id && "bg-primary/10 ring-2 ring-primary ring-inset"
                )}
                style={{ width: WORKER_COL_WIDTH }}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                    {getInitials(w.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium truncate">{w.full_name}</span>
              </div>

              {/* Hours cells */}
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div
                    className="relative flex-1"
                    style={{ width: HOURS.length * hourWidth }}
                    onPointerDown={(e) => handleRowPointerDown(e, w.id)}
                    onPointerMove={handleRowPointerMove}
                    onPointerUp={handleRowPointerUp}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCell(w.id); }}
                    onDragLeave={() => setDragOverCell(null)}
                    onDrop={(e) => handleCellDrop(e, w.id)}
                  >
                    {/* Hour separators */}
                    {HOURS.map((h, i) => (
                      <div
                        key={h}
                        className="absolute top-0 bottom-0 border-r border-border/60 pointer-events-none"
                        style={{ left: i * hourWidth, width: hourWidth }}
                      >
                        {[1, 2, 3].map((q) => (
                          <div
                            key={q}
                            className="absolute top-0 bottom-0 border-l border-dashed border-border/30"
                            style={{ left: q * (hourWidth / 4) }}
                          />
                        ))}
                      </div>
                    ))}

                    {/* Selection overlay */}
                    {isSelectingRow && selection && (
                      <div
                        className="absolute top-1 bottom-1 bg-primary/20 border-2 border-primary rounded-md pointer-events-none z-[1]"
                        style={{
                          left: ((selection.startMin - 7 * 60) / 60) * hourWidth,
                          width: ((selection.endMin - selection.startMin) / 60) * hourWidth,
                        }}
                      />
                    )}

                    {/* Tasks */}
                    {workerTasks.map((task) => {
                      const sH = parseInt(task.start_time.split(":")[0]);
                      const sM = parseInt(task.start_time.split(":")[1] || "0");
                      const left = ((sH * 60 + sM) - 7 * 60) / 60 * hourWidth;
                      return (
                        <div key={task.id} data-task-card style={{ position: "absolute", left, top: 0, bottom: 0 }}>
                          <DraggableTaskCard
                            task={task}
                            hourWidth={hourWidth}
                            onDragStart={handleTaskDragStart}
                            onClick={onTaskClick}
                            onResized={onRefresh}
                            hasOverlap={overlappingIds.has(task.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </ContextMenuTrigger>
                {onPaste && (
                  <ContextMenuContent>
                    <ContextMenuItem
                      disabled={!copiedTask}
                      onClick={() => onPaste(7, 0, w.id)}
                      className="gap-2"
                    >
                      <ClipboardPaste className="w-4 h-4" /> Coller la tâche
                    </ContextMenuItem>
                  </ContextMenuContent>
                )}
              </ContextMenu>
            </div>
          );
        })}
        {workers.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">Aucun ouvrier à afficher</div>
        )}
      </div>
    </div>
  );
}
