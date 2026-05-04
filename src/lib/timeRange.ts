/**
 * Helpers pour convertir entre heure de début + durée et heure de début + heure de fin.
 * Le format attendu est "HH:MM" (24h). La DB continue de stocker `duration_minutes`.
 */

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Calcule l'heure de fin "HH:MM" à partir d'un début et d'une durée en minutes. */
export function computeEndTime(startTime: string, durationMinutes: number): string {
  if (!startTime) return "";
  return fromMinutes(toMinutes(startTime) + (durationMinutes || 0));
}

/**
 * Calcule la durée en minutes entre deux heures HH:MM.
 * Si l'heure de fin est antérieure ou égale au début, on retourne au minimum 15 min.
 */
export function computeDurationMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const diff = toMinutes(endTime) - toMinutes(startTime);
  return diff > 0 ? diff : 15;
}