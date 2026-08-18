import { describe, it, expect } from "vitest";
import { occurrencesInYears } from "@/lib/recurrence";
import { format } from "date-fns";
const f = (ds: string, p: string, a: number, b: number) => occurrencesInYears(ds, p, a, b).map(d => format(d, "yyyy-MM-dd"));
describe("recurrence", () => {
  it("mensuel 31 janvier ne dérive pas", () => {
    const r = f("2026-01-31", "mensuel", 2026, 2026);
    expect(r.length).toBe(12);
    expect(r[1]).toBe("2026-02-28");
    expect(r[2]).toBe("2026-03-31");
    expect(r[11]).toBe("2026-12-31");
  });
  it("annuel 29 février bissextile", () => {
    expect(f("2028-02-29", "annuel", 2028, 2031)).toEqual(["2028-02-29","2029-02-28","2030-02-28","2031-02-28"]);
  });
  it("trimestriel change d'année", () => {
    expect(f("2026-11-15", "trimestriel", 2027, 2027)).toEqual(["2027-02-15","2027-05-15","2027-08-15","2027-11-15"]);
  });
  it("triennal / bisannuel", () => {
    expect(f("2026-06-01", "triennal", 2026, 2032)).toEqual(["2026-06-01","2029-06-01","2032-06-01"]);
    expect(f("2026-06-01", "bisannuel", 2026, 2030)).toEqual(["2026-06-01","2028-06-01","2030-06-01"]);
  });
  it("échéance passée : occurrences de l'année courante incluses", () => {
    expect(f("2024-03-10", "annuel", 2026, 2026)).toEqual(["2026-03-10"]);
  });
  it("pas de doublon", () => {
    const r = f("2026-01-15", "semestriel", 2026, 2029);
    expect(new Set(r).size).toBe(r.length);
  });
});
