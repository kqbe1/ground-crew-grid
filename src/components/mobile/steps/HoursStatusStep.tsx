import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TimeInput from "@/components/mobile/TimeInput";
import { CheckCircle2, Package, ShoppingCart, CalendarClock, Wrench, MoreHorizontal } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "termine", label: "Travail terminé", icon: CheckCircle2 },
  { value: "piece_a_commander", label: "Pièce à commander", icon: Package },
  { value: "piece_commandee", label: "Pièce commandée", icon: ShoppingCart },
  { value: "a_refixer", label: "A refixer pour autre travail", icon: CalendarClock },
  { value: "sav", label: "SAV", icon: Wrench },
  { value: "autre", label: "Autre", icon: MoreHorizontal },
];

export interface HoursStatusData {
  arrivalTime: string;
  departureTime: string;
  /** Statut principal (rétro-compat) = premier de statusDetails */
  statusDetail: string;
  /** Liste des statuts cochés (multi-sélection libre) */
  statusDetails: string[];
  /** Note libre par statut, indexée par valeur de statut */
  statusNotes: Record<string, string>;
}

interface Props {
  data: HoursStatusData;
  onChange: (data: HoursStatusData) => void;
}

export default function HoursStatusStep({ data, onChange }: Props) {
  const set = (key: keyof HoursStatusData, value: string) =>
    onChange({ ...data, [key]: value });

  const details = data.statusDetails ?? (data.statusDetail ? [data.statusDetail] : []);
  const notes = data.statusNotes ?? {};

  const toggleStatus = (value: string) => {
    const isSelected = details.includes(value);
    const next = isSelected ? details.filter((v) => v !== value) : [...details, value];
    onChange({
      ...data,
      statusDetails: next,
      statusDetail: next[0] ?? "",
      statusNotes: notes,
    });
  };

  const setNote = (value: string, note: string) => {
    onChange({
      ...data,
      statusDetails: details,
      statusDetail: details[0] ?? "",
      statusNotes: { ...notes, [value]: note },
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Heures & Statut</h2>

      <div className="bg-primary/5 rounded-lg px-3 py-2">
        <span className="text-sm font-semibold text-primary">Horaires</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Heure début</Label>
          <TimeInput value={data.arrivalTime} onChange={(v) => set("arrivalTime", v)} />
        </div>
        <div className="space-y-1.5">
          <Label>Heure fin</Label>
          <TimeInput value={data.departureTime} onChange={(v) => set("departureTime", v)} />
        </div>
      </div>

      <div className="bg-primary/5 rounded-lg px-3 py-2">
        <span className="text-sm font-semibold text-primary">Statut du travail * <span className="text-xs font-normal text-muted-foreground">(plusieurs possibles)</span></span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = details.includes(opt.value);
          return (
            <div key={opt.value} className="space-y-2">
              <button
                type="button"
                onClick={() => toggleStatus(opt.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <Icon className={`w-5 h-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium ${selected ? "text-primary" : ""}`}>{opt.label}</span>
                {selected && (
                  <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                )}
              </button>
              {selected && (
                <Textarea
                  value={notes[opt.value] ?? ""}
                  onChange={(e) => setNote(opt.value, e.target.value)}
                  placeholder={`Note pour « ${opt.label} »...`}
                  rows={2}
                  className="ml-2"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
