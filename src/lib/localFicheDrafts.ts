import { FICHE_DRAFT_PREFIX } from "@/lib/draftStorage";

export interface LocalFicheDraft {
  key: string;
  kind: "intervention" | "entretien";
  taskId: string;
  savedAt: number;
  step: number;
}

/** Liste les brouillons de fiche stockés localement (non encore envoyés). */
export function listLocalFicheDrafts(): LocalFicheDraft[] {
  const out: LocalFicheDraft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(FICHE_DRAFT_PREFIX)) continue;
      const rest = k.slice(FICHE_DRAFT_PREFIX.length); // "intervention:<taskId>"
      const idx = rest.indexOf(":");
      if (idx <= 0) continue;
      const kind = rest.slice(0, idx);
      const taskId = rest.slice(idx + 1);
      if ((kind !== "intervention" && kind !== "entretien") || !taskId || taskId === "new") continue;
      let parsed: any = {};
      try { parsed = JSON.parse(localStorage.getItem(k) || "{}"); } catch { /* ignore */ }
      out.push({
        key: k,
        kind,
        taskId,
        savedAt: typeof parsed?.savedAt === "number" ? parsed.savedAt : 0,
        step: typeof parsed?.step === "number" ? parsed.step : 1,
      });
    }
  } catch {
    // ignore
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export function removeLocalFicheDraft(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
