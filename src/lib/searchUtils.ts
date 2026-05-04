/**
 * Normalise une chaîne pour la recherche : minuscules + suppression des accents.
 * Permet de retrouver "Genève" en tapant "geneve", ou "café" en tapant "cafe".
 */
export function normalizeSearch(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Renvoie true si `text` contient `query` (insensible à la casse et aux accents). */
export function matchesSearch(text: string | null | undefined, query: string): boolean {
  if (!query) return true;
  return normalizeSearch(text).includes(normalizeSearch(query));
}