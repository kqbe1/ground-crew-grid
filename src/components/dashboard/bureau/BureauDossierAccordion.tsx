import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import BureauFicheTable from "./BureauFicheTable";
import type { UnifiedFiche } from "./types";

interface Props {
  fiches: UnifiedFiche[];
  onDelete: (fiche: UnifiedFiche) => void;
}

export default function BureauDossierAccordion({ fiches, onDelete }: Props) {
  const [openClients, setOpenClients] = useState<Set<string>>(new Set());

  // Group by clientId
  const grouped = fiches.reduce<Record<string, { name: string; city: string; fiches: UnifiedFiche[] }>>((acc, f) => {
    const key = f.clientId || "unknown";
    if (!acc[key]) acc[key] = { name: f.clientName, city: f.clientCity, fiches: [] };
    acc[key].fiches.push(f);
    return acc;
  }, {});

  const toggle = (key: string) => {
    setOpenClients((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const entries = Object.entries(grouped).sort(([, a], [, b]) => a.name.localeCompare(b.name));

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Aucun dossier en cours</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, group]) => (
        <Collapsible key={key} open={openClients.has(key)} onOpenChange={() => toggle(key)}>
          <CollapsibleTrigger className="w-full flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">{group.name}</span>
              {group.city && <span className="text-xs text-muted-foreground">{group.city}</span>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{group.fiches.length} fiche{group.fiches.length > 1 ? "s" : ""}</Badge>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openClients.has(key) && "rotate-180")} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 pl-4">
            <BureauFicheTable fiches={group.fiches} onDelete={onDelete} />
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
