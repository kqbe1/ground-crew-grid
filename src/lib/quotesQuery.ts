import { supabase } from "@/integrations/supabase/client";
import { normalizeSearch } from "@/lib/searchUtils";

// Source unique de vérité pour les statuts de devis
export const QUOTE_STATUSES = [
  "en_attente",
  "dossier_en_cours",
  "en_commande",
  "sav",
  "cloture",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

// Statuts considérés comme "à traiter" (affichés dans le dashboard)
export const ACTIVE_QUOTE_STATUSES: QuoteStatus[] = QUOTE_STATUSES.filter(
  (s) => s !== "cloture",
) as QuoteStatus[];

// Source unique de vérité pour les libellés et couleurs de statuts de devis.
// Utilisé partout (page Devis, dashboard, PDF, dialogs).
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  en_attente: "En attente",
  dossier_en_cours: "Dossier en cours",
  en_commande: "En commande",
  sav: "SAV",
  cloture: "Clôturé",
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  en_attente: "bg-amber-500",
  dossier_en_cours: "bg-blue-500",
  en_commande: "bg-purple-500",
  sav: "bg-orange-500",
  cloture: "bg-emerald-500",
};

export function quoteStatusLabel(status: string): string {
  return QUOTE_STATUS_LABELS[status as QuoteStatus] ?? status;
}

export function quoteStatusColor(status: string): string {
  return QUOTE_STATUS_COLORS[status as QuoteStatus] ?? "bg-muted";
}

// Sélection commune utilisée dans toute l'app pour les listes de devis
export const QUOTE_LIST_SELECT =
  "id, created_at, status, client_name, client_city, client_address, installation_type, created_by, internal_comments, profiles!quotes_created_by_fkey(full_name, worker_level)";

export interface FetchQuotesOptions {
  /** Si true, exclut les devis clôturés (vue "à traiter"). */
  activeOnly?: boolean;
}

/** Récupère la liste de devis avec une logique partagée entre Dashboard et page Devis. */
export async function fetchQuotes({ activeOnly = false }: FetchQuotesOptions = {}) {
  let query = supabase
    .from("quotes")
    .select(QUOTE_LIST_SELECT)
    .order("created_at", { ascending: false });

  if (activeOnly) {
    query = query.in("status", ACTIVE_QUOTE_STATUSES);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export interface QuoteFilterCriteria {
  /** "all" ou un statut précis */
  status?: string;
  /** "all" ou un type d'installation */
  installationType?: string;
  /** "all" ou un user_id (created_by) */
  createdBy?: string;
  /** texte libre — matche client_name / client_city / nom du créateur */
  search?: string;
}

/** Filtre côté client commun à la page Devis et au dashboard. */
export function filterQuotes<T extends Record<string, any>>(
  quotes: T[],
  { status = "all", installationType = "all", createdBy = "all", search = "" }: QuoteFilterCriteria = {},
): T[] {
  const s = search.trim() ? normalizeSearch(search) : "";
  return quotes.filter((q) => {
    if (status !== "all" && q.status !== status) return false;
    if (installationType !== "all" && q.installation_type !== installationType) return false;
    if (createdBy !== "all" && q.created_by !== createdBy) return false;
    if (s) {
      const hay = [q.client_name, q.client_city, q.profiles?.full_name]
        .filter(Boolean)
        .map((v: string) => normalizeSearch(v))
        .join(" ");
      if (!hay.includes(s)) return false;
    }
    return true;
  });
}