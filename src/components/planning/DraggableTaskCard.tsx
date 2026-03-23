import { useRef, useCallback } from "react";
import { MessageSquare, CheckCircle2, Package, Phone, Copy, AlertTriangle } from "lucide-react";
import { INTERVENTION_TYPE_COLORS, INTERVENTION_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu";
import { useTaskClipboard } from "@/components/planning/TaskClipboardContext";

const CELL_HEIGHT = 64; // h-16 = 64px per hour
const MIN_DURATION = 15;
const STEP = 15;

interface DraggableTaskCardProps {
  task: any;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onClick: (task: any) => void;
  onResized: () => void;
  hasOverlap?: boolean;
}

export default function DraggableTaskCard({ task, onDragStart, onClick, onResized, hasOverlap }: DraggableTaskCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const { copyTask } = useTaskClipboard();
  const startYRef = useRef(0);
  const startDurationRef = useRef(0);

  const startH = parseInt(task.start_time.split(":")[0]);
  const startM = parseInt(task.start_time.split(":")[1] || "0");
  const endMinutes = startH * 60 + startM + task.duration_minutes;
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  const timeRange = `${task.start_time?.slice(0, 5)} – ${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

  const heightPx = Math.max((task.duration_minutes / 60) * CELL_HEIGHT, 60);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startDurationRef.current = task.duration_minutes;

    const card = cardRef.current;
    if (!card) return;

    const handleMove = (ev: PointerEvent) => {
      if (!resizingRef.current || !card) return;
      const deltaY = ev.clientY - startYRef.current;
      const deltaMinutes = Math.round((deltaY / CELL_HEIGHT) * 60 / STEP) * STEP;
      const newDuration = Math.max(MIN_DURATION, startDurationRef.current + deltaMinutes);
      const newHeight = Math.max((newDuration / 60) * CELL_HEIGHT, 60);
      card.style.height = `${newHeight}px`;
      card.dataset.pendingDuration = String(newDuration);
    };

    const handleUp = async () => {
      resizingRef.current = false;
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);

      const pendingDuration = card?.dataset.pendingDuration;
      if (!pendingDuration || Number(pendingDuration) === task.duration_minutes) return;

      const { error } = await supabase
        .from("work_tasks")
        .update({ duration_minutes: Number(pendingDuration) })
        .eq("id", task.id);

      if (error) {
        toast.error("Erreur lors du redimensionnement");
        if (card) card.style.height = `${heightPx}px`;
      } else {
        toast.success(`Durée: ${pendingDuration} min`);
        onResized();
      }
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }, [task.id, task.duration_minutes, heightPx, onResized]);

  const handleCopy = useCallback(() => {
    copyTask(task);
    toast.success("Tâche copiée — clic droit sur une cellule pour coller");
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
          className={cn(
            "absolute inset-x-1 rounded-xl px-2.5 py-1.5 text-xs cursor-grab active:cursor-grabbing z-[1] select-none border shadow-md flex flex-col gap-0.5 overflow-hidden",
            INTERVENTION_TYPE_COLORS[task.intervention_type] || "badge-autre",
            hasOverlap ? "border-destructive border-2 ring-2 ring-destructive/30" : "border-white/20"
          )}
          style={{ height: `${heightPx}px` }}
        >
          <div className="font-bold truncate text-[13px] leading-tight flex items-center gap-1">
            {hasOverlap && <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />}
            {task.title}
          </div>
          <div className="font-semibold opacity-90 text-[11px]">{timeRange}</div>
          {task.clients?.name && (
            <div className="truncate opacity-90 text-[11px] mt-0.5">{task.clients.name}</div>
          )}
          {(task.client_sites?.address || task.clients?.address_intervention) && (
            <div className="truncate opacity-75 text-[10px]">
              {task.client_sites?.address || task.clients?.address_intervention}
            </div>
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

          {/* Resize handle */}
          <div
            onPointerDown={handleResizeStart}
            className="absolute bottom-0 inset-x-0 h-3 cursor-s-resize flex items-center justify-center touch-none"
          >
            <div className="w-8 h-1 rounded-full bg-white/40" />
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleCopy} className="gap-2">
          <Copy className="w-4 h-4" />
          Copier cette tâche
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
