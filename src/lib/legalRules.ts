import { supabase } from "@/integrations/supabase/client";
import { PERIODICITY_LABELS } from "@/lib/constants";

/** Ordre croissant d'intervalle : la plus stricte en premier. */
const PERIODICITY_ORDER = [
  "mensuel",
  "trimestriel",
  "semestriel",
  "annuel",
  "bisannuel",
  "triennal",
] as const;

export function strictestPeriodicity(a: string, b: string) {
  return PERIODICITY_ORDER.indexOf(a as any) <= PERIODICITY_ORDER.indexOf(b as any) ? a : b;
}

/**
 * Charge les règles légales configurées en interne (onglet Admin) et retourne,
 * par type d'énergie, la périodicité la plus stricte configurée.
 * La région est un paramètre interne des règles, plus une donnée du client.
 */
export async function loadLegalPeriodicityByEnergy(): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("legal_maintenance_rules" as any)
    .select("energy_type, periodicity");
  const map: Record<string, string> = {};
  (data ?? []).forEach((r: any) => {
    map[r.energy_type] = map[r.energy_type]
      ? strictestPeriodicity(map[r.energy_type], r.periodicity)
      : r.periodicity;
  });
  return map;
}

export function periodicityLabel(p?: string | null) {
  if (!p) return "";
  return PERIODICITY_LABELS[p] ?? p;
}
