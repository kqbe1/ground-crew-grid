export type BureauFilterType = "received" | "en_attente" | "dossier_en_cours" | "commande" | "sav" | "cloturees" | "devis";
export type FicheType = "FI" | "FE" | "FD";
export type SortColumn = "type" | "client" | "date" | "status";
export type SortDir = "asc" | "desc";

export interface UnifiedFiche {
  id: string;
  type: FicheType;
  clientName: string;
  clientCity: string;
  clientId: string | null;
  techName: string;
  techLevel: string | null;
  date: string;
  time: string | null;
  status: string;
  statusLabel: string;
  sourceTable: "intervention_sheets" | "quotes";
}
