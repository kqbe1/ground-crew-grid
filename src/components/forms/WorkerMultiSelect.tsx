import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Props {
  workers: { id: string; full_name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Ouvrier principal déjà sélectionné ailleurs (affiché comme coché/désactivé). */
  primaryId?: string;
}

export default function WorkerMultiSelect({ workers, value, onChange, primaryId }: Props) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border p-2 max-h-40 overflow-y-auto">
      {workers.length === 0 && <p className="text-sm text-muted-foreground">Aucun ouvrier</p>}
      {workers.map((w) => {
        const isPrimary = w.id === primaryId;
        return (
          <label key={w.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={isPrimary || value.includes(w.id)}
              disabled={isPrimary}
              onCheckedChange={() => toggle(w.id)}
            />
            <span className={isPrimary ? "text-muted-foreground" : ""}>{w.full_name}</span>
          </label>
        );
      })}
    </div>
  );
}

export function WorkerMultiSelectField(props: Props & { label?: string }) {
  const { label = "Ouvriers supplémentaires", ...rest } = props;
  return (
    <div>
      <Label>{label}</Label>
      <WorkerMultiSelect {...rest} />
    </div>
  );
}
