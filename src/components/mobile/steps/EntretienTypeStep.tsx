import { Flame, Droplets, Wind, Snowflake, CheckCircle2 } from "lucide-react";

const ENTRETIEN_TYPES = [
  { value: "chaudiere", label: "Chaudière", icon: Flame },
  { value: "boiler", label: "Boiler", icon: Droplets },
  { value: "poele_pellet", label: "Poêle à Pellet", icon: Flame },
  { value: "poele_bois", label: "Poêle à Bois", icon: Flame },
  { value: "vmc", label: "VMC", icon: Wind },
  { value: "climatisation", label: "Climatisation", icon: Snowflake },
];

export interface EntretienTypeData {
  type: string;
  combustible: string;
  montage: string;
  installation: string;
  controlePeriodique: string;
  typeFlux: string;
}

export const emptyEntretienType: EntretienTypeData = {
  type: "", combustible: "", montage: "", installation: "", controlePeriodique: "", typeFlux: "",
};

interface Props {
  data: EntretienTypeData;
  onChange: (data: EntretienTypeData) => void;
}

function ToggleButtons({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="bg-primary/5 rounded-lg px-3 py-1.5">
        <span className="text-xs font-semibold text-primary">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
              value === opt.value
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/40"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EntretienTypeStep({ data, onChange }: Props) {
  const set = (key: keyof EntretienTypeData, value: string) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Type d'intervention</h2>

      <div className="grid grid-cols-2 gap-3">
        {ENTRETIEN_TYPES.map((t) => {
          const Icon = t.icon;
          const selected = data.type === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ ...emptyEntretienType, type: t.value })}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors relative ${
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <Icon className={`w-6 h-6 ${selected ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${selected ? "text-primary" : ""}`}>{t.label}</span>
              {selected && (
                <CheckCircle2 className="w-4 h-4 text-primary absolute top-2 right-2" />
              )}
            </button>
          );
        })}
      </div>

      {data.type === "chaudiere" && (
        <div className="space-y-3">
          <ToggleButtons
            label="Combustible"
            options={[{ value: "mazout", label: "Mazout" }, { value: "gaz", label: "Gaz" }]}
            value={data.combustible}
            onChange={(v) => set("combustible", v)}
          />
          <ToggleButtons
            label="Type de montage"
            options={[{ value: "murale", label: "Murale" }, { value: "sol", label: "Sol" }]}
            value={data.montage}
            onChange={(v) => set("montage", v)}
          />
          <ToggleButtons
            label="Installation"
            options={[{ value: "atmospherique", label: "Atmosphérique" }, { value: "condensation", label: "Condensation" }]}
            value={data.installation}
            onChange={(v) => set("installation", v)}
          />
          <ToggleButtons
            label="Contrôle périodique"
            options={[{ value: "oui", label: "Oui" }, { value: "non", label: "Non" }]}
            value={data.controlePeriodique}
            onChange={(v) => set("controlePeriodique", v)}
          />
        </div>
      )}

      {data.type === "vmc" && (
        <ToggleButtons
          label="Type de flux"
          options={[{ value: "simple", label: "Simple Flux" }, { value: "double", label: "Double Flux" }]}
          value={data.typeFlux}
          onChange={(v) => set("typeFlux", v)}
        />
      )}
    </div>
  );
}
