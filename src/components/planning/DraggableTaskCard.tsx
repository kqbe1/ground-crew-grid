import { useRef, useCallback } from "react";
import { Copy, AlertTriangle } from "lucide-react";
import { INTERVENTION_TYPE_COLORS, INTERVENTION_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu";
import { useTaskClipboard } from "@/components/planning/TaskClipboardContext";

const MIN_DURATION = 15;
const STEP = 15;

interface DraggableTaskCardProps {
  task: any;
  hourWidth: number;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onClick: (task: any) => void;
  onResized: () => void;
  hasOverlap?: boolean;
  workerLabel?: string | null;
}

export default function DraggableTaskCard({ task, hourWidth, onDragStart, onClick, onResized, hasOverlap, workerLabel }: DraggableTaskCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const { copyTask } = useTaskClipboard();
  const startXRef = useRef(0);
  const startDurationRef = useRef(0);

  const startH = parseInt(task.start_time.split(":")[0]);
  const startM = parseInt(task.start_time.split(":")[1] || "0");
  const endMinutes = startH * 60 + startM + task.duration_minutes;
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  const timeRange = `${task.start_time?.slice(0, 5)}–${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

  const widthPx = Math.max((task.duration_minutes / 60) * hourWidth, hourWidth / 4);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startDurationRef.current = task.duration_minutes;
    const card = cardRef.current;
    if (!card) return;

    const handleMove = (ev: PointerEvent) => {
      if (!resizingRef.current || !card) return;
      const deltaX = ev.clientX - startXRef.current;
      const deltaMinutes = Math.round((deltaX / hourWidth) * 60 / STEP) * STEP;
      const newDuration = Math.max(MIN_DURATION, startDurationRef.current + deltaMinutes);
      const newWidth = Math.max((newDuration / 60) * hourWidth, hourWidth / 4);
      card.style.width = `${newWidth}px`;
      card.dataset.pendingDuration = String(newDuration);
    };
    const handleUp = async () => {
      resizingRef.current = false;
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      const pd = card?.dataset.pendingDuration;
      if (!pd || Number(pd) === task.duration_minutes) return;
      const { error } = await supabase.from("work_tasks").update({ duration_minutes: Number(pd) }).eq("id", task.id);
      if (error) {
        toast.error("Erreur redimensionnement");
        if (card) card.style.width = `${widthPx}px`;
      } else {
        toast.success(`Durée: ${pd} min`);
        onResized();
      }
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }, [task.id, task.duration_minutes, widthPx, hourWidth, onResized]);

  const handleCopy = useCallback(() => {
    copyTask(task);
    toast.success("Tâche copiée");
  }, [copyTask, task]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={cardRef}
          draggable
          onDragStart={(e) => {
            if (resizingRef.current) { e.preventDefault(); return; }
            e.stopPropagation();
            onDragStart(e, task.id);
          }}
          onClick={(e) => {
            if (resizingRef.current) return;
            e.stopPropagation();
            onClick(task);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-1 bottom-1 rounded-lg px-2 py-1 text-[11px] cursor-grab active:cursor-grabbing z-[2] select-none border shadow-sm flex flex-col gap-0 overflow-hidden leading-tight",
            INTERVENTION_TYPE_COLORS[task.intervention_type] || "badge-autre",
            hasOverlap ? "border-destructive border-2 ring-2 ring-destructive/30" : "border-white/20"
          )}
          style={{ width: `${widthPx}px` }}
        >
          <div className="font-bold truncate text-[11px] leading-tight flex items-center gap-1">
            {hasOverlap && <AlertTriangle className="w-3 h-3 shrink-0" />}
            {workerLabel && (
              <span className="shrink-0 rounded bg-black/30 px-1 py-[1px] text-[9px] font-bold tracking-wide">
                {workerLabel}
              </span>
            )}
            {task.title}
          </div>
          {task.clients?.name && (
            <div className="truncate opacity-90 text-[10px]">{task.clients.name}</div>
          )}
          <div className="truncate opacity-80 text-[10px]">{timeRange}</div>
          <div
            onPointerDown={handleResizeStart}
            className="absolute right-0 inset-y-0 w-3 cursor-e-resize flex items-center justify-center touch-none"
          >
            <div className="h-8 w-1 rounded-full bg-white/40" />
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleCopy} className="gap-2">
          <Copy className="w-4 h-4" /> Copier cette tâche
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
