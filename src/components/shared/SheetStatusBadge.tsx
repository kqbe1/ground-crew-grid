import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Pencil, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export type SheetStatus = "draft" | "submitted" | "completed" | null | undefined;

/**
 * Compute the unified sheet lifecycle status from an intervention_sheets row.
 */
export function computeSheetStatus(sheet?: { is_draft?: boolean | null; final_status?: string | null } | null): SheetStatus {
  if (!sheet) return null;
  if (sheet.is_draft) return "draft";
  if (sheet.final_status === "termine") return "completed";
  return "submitted";
}

/**
 * Border + tint class for a card/row reflecting the sheet status.
 */
export function sheetStatusBorderClass(status: SheetStatus): string {
  switch (status) {
    case "draft":
      return "border-l-4 border-l-status-replanifier bg-status-replanifier/5";
    case "submitted":
      return "border-l-4 border-l-status-planifie bg-status-planifie/5";
    case "completed":
      return "border-l-4 border-l-status-termine bg-status-termine/5";
    default:
      return "";
  }
}

interface SheetStatusBadgeProps {
  status: SheetStatus;
  className?: string;
}

export function SheetStatusBadge({ status, className }: SheetStatusBadgeProps) {
  if (!status) return null;
  if (status === "draft") {
    return (
      <Badge variant="outline" className={cn("text-[10px] gap-1 badge-sheet-draft", className)}>
        <Pencil className="w-3 h-3" /> Brouillon
      </Badge>
    );
  }
  if (status === "submitted") {
    return (
      <Badge variant="outline" className={cn("text-[10px] gap-1 badge-sheet-submitted", className)}>
        <Send className="w-3 h-3" /> Envoyé au bureau
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("text-[10px] gap-1 badge-sheet-completed", className)}>
      <CheckCircle2 className="w-3 h-3" /> Terminé
    </Badge>
  );
}