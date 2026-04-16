import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { FicheType } from "./types";

interface Worker {
  id: string;
  full_name: string;
}

interface Props {
  typeFilter: FicheType | "all";
  onTypeChange: (v: FicheType | "all") => void;
  techFilter: string;
  onTechChange: (v: string) => void;
  searchClient: string;
  onSearchChange: (v: string) => void;
  workers: Worker[];
}

export default function BureauFilterBar({ typeFilter, onTypeChange, techFilter, onTechChange, searchClient, onSearchChange, workers }: Props) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Select value={typeFilter} onValueChange={(v) => onTypeChange(v as FicheType | "all")}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes</SelectItem>
          <SelectItem value="FI">FI — Intervention</SelectItem>
          <SelectItem value="FE">FE — Entretien</SelectItem>
          <SelectItem value="FD">FD — Devis</SelectItem>
        </SelectContent>
      </Select>

      <Select value={techFilter} onValueChange={onTechChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Technicien" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous</SelectItem>
          {workers.map((w) => (
            <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un client…"
          value={searchClient}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>
    </div>
  );
}
