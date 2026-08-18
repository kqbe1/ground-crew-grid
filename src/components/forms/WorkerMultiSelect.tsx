import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Props {
  workers: { id: string; full_name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Ouvrier principal déjà sélectionné ailleurs (affiché comme coché/désactivé). */
  primaryId?: string;
}

export default function WorkerMultiSelect({ workers, value, onChange, primaryId }: Props) {
  const [search, setSearch] = useState("");
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  const filtered = useMemo(
    () => workers.filter((w) => w.full_name.toLowerCase().includes(search.trim().toLowerCase())),
    [workers, search],
  );
  const selectedCount = value.length + (primaryId ? 1 : 0);

  return (
    <div className="rounded-md border">
      <div className="p-2 border-b">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un ouvrier..."
          className="h-8"
        />
      </div>
      <div className="max-h-40 overflow-y-auto divide-y">
        {filtered.length === 0 && <p className="p-2 text-sm text-muted-foreground">Aucun ouvrier</p>}
        {filtered.map((w) => {
          const isPrimary = w.id === primaryId;
          return (
            <label key={w.id} className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer hover:bg-muted/50">
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
      <div className="px-2 py-1 border-t text-xs text-muted-foreground">{selectedCount} sélectionné(s)</div>
    </div>
  );
}

export function WorkerMultiSelectField(props: Props & { label?: string }) {
  const { label = "Ouvriers supplémentaires", ...rest } = props;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <WorkerMultiSelect {...rest} />
    </div>
  );
}
