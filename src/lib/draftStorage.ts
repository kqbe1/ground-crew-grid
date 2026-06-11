/**
 * Utilitaires de gestion des brouillons stockés côté navigateur.
 *
 * Brouillons gérés :
 * - `fiche_draft:intervention:<taskId>` (localStorage) — fiche d'intervention mobile
 * - `fiche_draft:entretien:<taskId>`    (localStorage) — fiche d'entretien mobile
 * - `create_task_draft_v1`              (sessionStorage) — dialogue Créer une tâche
 * - `planning_view_state_v1`            (sessionStorage) — filtres/vue du planning
 */

export const FICHE_DRAFT_PREFIX = "fiche_draft:";
export const MAX_FICHE_DRAFT_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 jours

const SESSION_DRAFT_KEYS = ["create_task_draft_v1", "planning_view_state_v1"] as const;

/** Supprime tous les brouillons (à appeler à la déconnexion). */
export function purgeAllDrafts() {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(FICHE_DRAFT_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
  try {
    SESSION_DRAFT_KEYS.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/** Supprime les brouillons de fiche plus anciens que `maxAgeMs`. */
export function pruneStaleFicheDrafts(maxAgeMs: number = MAX_FICHE_DRAFT_AGE_MS) {
  try {
    const now = Date.now();
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(FICHE_DRAFT_PREFIX)) continue;
      try {
        const raw = localStorage.getItem(k);
        if (!raw) { toRemove.push(k); continue; }
        const parsed = JSON.parse(raw);
        const savedAt = typeof parsed?.savedAt === "number" ? parsed.savedAt : 0;
        if (!savedAt || now - savedAt > maxAgeMs) toRemove.push(k);
      } catch {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}