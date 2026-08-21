import { addMonths, getMonth, getYear, parseISO } from "date-fns";

export const PERIODICITY_MONTHS: Record<string, number> = {
  mensuel: 1, trimestriel: 3, semestriel: 6, annuel: 12, bisannuel: 24, triennal: 36,
};

/** Parse a "yyyy-MM-dd" date column as a local date (avoids UTC day shifts). */
export function parseDueDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value.length > 10 ? value.slice(0, 10) : value);
  return isNaN(d.getTime()) ? null : d;
}

export function periodMonthsOf(periodicity: string | null | undefined): number {
  return PERIODICITY_MONTHS[periodicity ?? ""] || 12;
}

/**
 * Occurrences of a recurring schedule within [fromYear, toYear].
 * Always computed as base + k * period from the anchor date, so month-end
 * dates (31 Jan, 29 Feb...) never drift across cycles.
 */
export function occurrencesInYears(
  nextDueDate: string | null | undefined,
  periodicity: string | null | undefined,
  fromYear: number,
  toYear: number,
): Date[] {
  const base = parseDueDate(nextDueDate);
  if (!base) return [];
  const period = periodMonthsOf(periodicity);
  const out: Date[] = [];

  // Months between the base date and January of fromYear
  const monthsDiff = (fromYear - getYear(base)) * 12 - getMonth(base);
  let k = Math.floor(monthsDiff / period) - 1;

  for (let i = 0; i < 600; i++, k++) {
    const d = addMonths(base, k * period);
    const yr = getYear(d);
    if (yr > toYear) break;
    if (yr >= fromYear) out.push(d);
  }
  return out;
}

/**
 * Ajuste une date proposée au client au dernier jour ouvrable
 * lorsque l'échéance tombe un week-end.
 * La date d'échéance réelle en base n'est jamais modifiée.
 */
export function getWeekdayProposal(value: string): string {
  const date = parseDueDate(value);
  if (!date) return value;

  const day = date.getDay();

  if (day === 6) {
    date.setDate(date.getDate() - 1); // samedi ? vendredi
  } else if (day === 0) {
    date.setDate(date.getDate() - 2); // dimanche ? vendredi
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${dayOfMonth}`;
}
