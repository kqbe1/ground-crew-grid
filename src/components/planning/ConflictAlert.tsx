import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { slotLabel, type WorkerConflict } from "@/lib/overlapUtils";

interface Props {
  conflicts: WorkerConflict[];
  workerNames: Record<string, string>;
  /** Focus direct sur le champ heure/durée à corriger */
  onFix?: () => void;
}

/**
 * Alerte bloquante affichée lorsqu'un chevauchement horaire est détecté.
 * Liste les tâches concernées, leurs horaires et les ouvriers impactés.
 */
export default function ConflictAlert({ conflicts, workerNames, onFix }: Props) {
  if (conflicts.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-destructive/60">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        Conflit horaire — {conflicts.length} chevauchement{conflicts.length > 1 ? "s" : ""}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <ul className="mt-1 space-y-1 text-sm">
          {conflicts.map(({ workerId, task }) => (
            <li key={`${workerId}-${task.id}`} className="leading-tight">
              <span className="font-semibold">{workerNames[workerId] ?? "Ouvrier"}</span>
              {" — "}
              {slotLabel(task.start_time?.slice(0, 5) ?? "", task.duration_minutes ?? 0)}
              {task.title ? ` · ${task.title}` : ""}
            </li>
          ))}
        </ul>
        <p className="text-xs">
          Modifiez l'heure de début, l'heure de fin ou l'ouvrier assigné pour pouvoir valider.
        </p>
        {onFix && (
          <Button type="button" size="sm" variant="outline" onClick={onFix}>
            Corriger l'horaire
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
