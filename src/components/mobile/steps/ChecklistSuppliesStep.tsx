import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { EntretienTypeData } from "./EntretienTypeStep";

const CHECKLISTS: Record<string, string[]> = {
  "chaudiere_gaz": [
    "Électrode standard", "Électrode spécifique", "Joint brûleur",
    "Purgeur automatique", "Vanne 3 voies", "Vase expansion", "Autre",
  ],
  "chaudiere_mazout": [
    "Électrode", "Électrode spécifique", "Filtre", "Filtre pompe",
    "Gicleur", "Gicleur spécial", "Joint brûleur", "Ramonage", "Vase expansion", "Autre",
  ],
  "boiler": ["Groupe de sécurité", "Joint", "Autre"],
  "poele_pellet": ["Bougie", "Ramonage", "Autre"],
  "poele_bois": ["Brique", "Ramonage", "Autre"],
  "vmc": ["Filtre", "Autre"],
  "climatisation": ["Filtre", "Autre"],
};

function getChecklistKey(entretienType: EntretienTypeData): string {
  if (entretienType.type === "chaudiere" && entretienType.combustible) {
    return `chaudiere_${entretienType.combustible}`;
  }
  return entretienType.type;
}

function getChecklistLabel(entretienType: EntretienTypeData): string {
  const labels: Record<string, string> = {
    chaudiere: "Chaudière",
    boiler: "Boiler",
    poele_pellet: "Poêle à Pellet",
    poele_bois: "Poêle à Bois",
    vmc: "VMC",
    climatisation: "Climatisation",
  };
  let label = labels[entretienType.type] || entretienType.type;
  if (entretienType.type === "chaudiere" && entretienType.combustible) {
    label += ` ${entretienType.combustible === "gaz" ? "Gaz" : "Mazout"}`;
  }
  return label;
}

interface Props {
  entretienType: EntretienTypeData;
  supplies: string;
  onSuppliesChange: (v: string) => void;
  checkedItems: Record<string, boolean>;
  onCheckedItemsChange: (items: Record<string, boolean>) => void;
}

export default function ChecklistSuppliesStep({
  entretienType,
  supplies,
  onSuppliesChange,
  checkedItems,
  onCheckedItemsChange,
}: Props) {
  const key = getChecklistKey(entretienType);
  const items = CHECKLISTS[key] || [];
  const typeLabel = getChecklistLabel(entretienType);
  const hasError = !supplies.trim();

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Checklist fournitures & service</h2>

      <div className="bg-primary/5 rounded-lg px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">Fournitures utilisées</span>
        <span className="text-xs text-destructive font-medium">* obligatoire</span>
      </div>

      <Textarea
        value={supplies}
        onChange={(e) => onSuppliesChange(e.target.value)}
        placeholder="Décrire les fournitures utilisées..."
        rows={3}
        className={hasError ? "border-destructive" : ""}
      />

      {items.length > 0 && (
        <>
          <div className="bg-primary/5 rounded-lg px-3 py-2">
            <span className="text-sm font-semibold text-primary">Checklist — {typeLabel}</span>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <label
                key={item}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors cursor-pointer ${
                  checkedItems[item]
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <Checkbox
                  checked={!!checkedItems[item]}
                  onCheckedChange={(v) =>
                    onCheckedItemsChange({ ...checkedItems, [item]: !!v })
                  }
                />
                <span className="text-sm">{item}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
