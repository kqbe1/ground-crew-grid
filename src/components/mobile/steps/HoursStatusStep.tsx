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
  statusDetail: string;
  statusComment: string;
}

interface Props {
  data: HoursStatusData;
  onChange: (data: HoursStatusData) => void;
}

export default function HoursStatusStep({ data, onChange }: Props) {
  const set = (key: keyof HoursStatusData, value: string) =>
    onChange({ ...data, [key]: value });

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
        <span className="text-sm font-semibold text-primary">Statut du travail *</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = data.statusDetail === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("statusDetail", opt.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
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
          );
        })}
      </div>

      <div className="space-y-1.5">
        <Label>Commentaire éventuel</Label>
        <Textarea
          value={data.statusComment}
          onChange={(e) => set("statusComment", e.target.value)}
          placeholder="Commentaire éventuel..."
          rows={3}
        />
      </div>
    </div>
  );
}
