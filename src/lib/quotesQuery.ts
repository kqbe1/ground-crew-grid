import { supabase } from "@/integrations/supabase/client";

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