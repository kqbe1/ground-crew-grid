import { Card, CardContent } from "@/components/ui/card";
import { Clock, FolderOpen, Package, Wrench, CheckCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BureauFilterType } from "./types";

interface FilterCardDef {
  key: BureauFilterType;
  label: string;
  icon: React.ElementType;
  color: string;
}

const CARDS: FilterCardDef[] = [
  { key: "en_attente", label: "En attente", icon: Clock, color: "text-[hsl(var(--color-replanifier))]" },
  { key: "dossier_en_cours", label: "Dossier en cours", icon: FolderOpen, color: "text-[hsl(var(--color-planifie))]" },
  { key: "commande", label: "Commande", icon: Package, color: "text-[hsl(var(--color-piece))]" },
  { key: "sav", label: "SAV", icon: Wrench, color: "text-[hsl(var(--color-sav))]" },
  { key: "cloturees", label: "Clôturées", icon: CheckCircle, color: "text-[hsl(var(--color-termine))]" },
  { key: "devis", label: "Devis", icon: FileText, color: "text-[hsl(var(--color-rdv))]" },
];

interface Props {
  active: BureauFilterType | null;
  counts: Record<BureauFilterType, number>;
  onSelect: (key: BureauFilterType) => void;
}

export default function BureauFilterCards({ active, counts, onSelect }: Props) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {CARDS.map((c) => (
        <Card
          key={c.key}
          className={cn(
            "cursor-pointer transition-all hover:shadow-md select-none",
            active === c.key && "ring-2 ring-primary shadow-md"
          )}
          onClick={() => onSelect(c.key)}
        >
          <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
            <c.icon className={cn("w-5 h-5", c.color)} />
            <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
            <span className="text-lg font-bold">{counts[c.key] ?? 0}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
