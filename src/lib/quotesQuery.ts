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
  en_attente: "bg-[hsl(var(--color-replanifier))]",
  dossier_en_cours: "bg-[hsl(var(--color-planifie))]",
  en_commande: "bg-[hsl(var(--color-piece))]",
  sav: "bg-[hsl(var(--color-sav))]",
  cloture: "bg-[hsl(var(--color-termine))]",
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
  /** Force le rechargement et ignore le cache. */
  force?: boolean;
}

// --- Cache léger + déduplication des requêtes ---
// On charge toujours TOUS les devis en une seule requête réseau ; les vues
// (page Devis / cartes dashboard) dérivent ensuite leur sous-ensemble côté
// client. Cela évite des appels Supabase parallèles redondants quand les deux
// vues se montent en même temps.
const CACHE_TTL_MS = 15_000;
let cache: { at: number; data: any[] } | null = null;
let inflight: Promise<any[]> | null = null;

async function loadAllQuotes(): Promise<any[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select(QUOTE_LIST_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Invalide manuellement le cache (à appeler après une mutation locale). */
export function invalidateQuotesCache() {
  cache = null;
}

/** Récupère la liste de devis (cache + déduplication des appels concurrents). */
export async function fetchQuotes({ activeOnly = false, force = false }: FetchQuotesOptions = {}) {
  const fresh = cache && Date.now() - cache.at < CACHE_TTL_MS;
  if (force) cache = null;

  let all: any[];
  if (!force && fresh && cache) {
    all = cache.data;
  } else if (inflight) {
    // Une requête est déjà en vol → on s'y attache (dédup).
    all = await inflight;
  } else {
    inflight = loadAllQuotes()
      .then((data) => {
        cache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
    all = await inflight;
  }

  return activeOnly
    ? all.filter((q) => q.status !== "cloture")
    : all;
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

/** Sérialise une liste de devis filtrée vers un CSV (mêmes colonnes que la liste UI). */
export function quotesToCsv(quotes: any[]): string {
  const headers = [
    "Date",
    "Client",
    "Ville",
    "Adresse",
    "Installation",
    "Statut",
    "Créé par",
  ];
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = quotes.map((q) => [
    q.created_at ? new Date(q.created_at).toISOString() : "",
    q.client_name ?? "",
    q.client_city ?? "",
    q.client_address ?? "",
    q.installation_type ?? "",
    quoteStatusLabel(q.status),
    q.profiles?.full_name ?? "",
  ]);
  return [headers, ...rows].map((r) => r.map(escape).join(";")).join("\n");
}