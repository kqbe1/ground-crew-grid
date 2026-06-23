import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PERIODICITY_LABELS, ENERGY_TYPE_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ENERGIES = ["gaz", "mazout", "pellets", "clim", "vmc"] as const;
const REGIONS = [
  { key: "bruxelles", label: "Bruxelles" },
  { key: "wallonie", label: "Wallonie" },
  { key: "flandre", label: "Flandre" },
];

type Rule = {
  id?: string;
  energy_type: string;
  region: string;
  periodicity: string;
};

export default function LegalRulesTab() {
  const [rules, setRules] = useState<Record<string, Rule>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const key = (e: string, r: string) => `${e}|${r}`;

  const fetchRules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("legal_maintenance_rules" as any)
      .select("*");
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const map: Record<string, Rule> = {};
    (data ?? []).forEach((r: any) => {
      map[key(r.energy_type, r.region)] = r;
    });
    setRules(map);
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, []);

  const updateRule = async (energy: string, region: string, periodicity: string) => {
    const k = key(energy, region);
    setSaving(k);
    const existing = rules[k];
    try {
      if (existing?.id) {
        const { error } = await supabase
          .from("legal_maintenance_rules" as any)
          .update({ periodicity })
          .eq("id", existing.id);
        if (error) throw error;
        setRules((prev) => ({ ...prev, [k]: { ...existing, periodicity } }));
      } else {
        const { data, error } = await supabase
          .from("legal_maintenance_rules" as any)
          .insert({ energy_type: energy, region, periodicity })
          .select()
          .single();
        if (error) throw error;
        setRules((prev) => ({ ...prev, [k]: data as any }));
      }
      toast.success("Règle mise à jour");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Échéances légales des entretiens</CardTitle>
        <p className="text-sm text-muted-foreground">
          Définissez la périodicité légale d'entretien par combustible et par région.
          Ces valeurs seront proposées automatiquement à la création d'un entretien.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Combustible</TableHead>
                {REGIONS.map((r) => <TableHead key={r.key}>{r.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ENERGIES.map((energy) => (
                <TableRow key={energy}>
                  <TableCell className="font-medium">{ENERGY_TYPE_LABELS[energy] ?? energy}</TableCell>
                  {REGIONS.map((r) => {
                    const k = key(energy, r.key);
                    const rule = rules[k];
                    return (
                      <TableCell key={r.key}>
                        <Select
                          value={rule?.periodicity ?? ""}
                          onValueChange={(v) => updateRule(energy, r.key, v)}
                          disabled={saving === k}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PERIODICITY_LABELS).map(([k2, v]) => (
                              <SelectItem key={k2} value={k2}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={fetchRules}>Rafraîchir</Button>
        </div>
      </CardContent>
    </Card>
  );
}