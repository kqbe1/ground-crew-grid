import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { differenceInDays } from "date-fns";

interface LegalAlert {
  clientId: string;
  clientName: string;
  region: string | null;
  equipmentName: string;
  energyType: string;
  nextDueDate: string;
  requiredPeriodicity: string;
  daysUntilDue: number;
}

const ENERGY_LEGAL_RULES: Record<string, (region: string | null) => { periodicity: string; label: string } | null> = {
  mazout: () => ({ periodicity: "annuel", label: "Annuel (toutes régions)" }),
  pellets: () => ({ periodicity: "annuel", label: "Annuel (toutes régions)" }),
  gaz: (region) => {
    if (region === "bruxelles") return { periodicity: "bisannuel", label: "Biennal (Bruxelles)" };
    if (region === "wallonie") return { periodicity: "triennal", label: "Triennal (Wallonie)" };
    return { periodicity: "annuel", label: "Annuel (défaut)" };
  },
};

export default function LegalAlertsPanel() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<LegalAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      // Fetch equipment with their sites and clients
      const { data: equipment } = await supabase
        .from("client_equipment")
        .select("id, name, energy_type, next_maintenance_date, maintenance_periodicity, client_sites(id, client_id, clients(id, name, region))");

      if (!equipment) { setLoading(false); return; }

      const now = new Date();
      const alertList: LegalAlert[] = [];

      for (const eq of equipment) {
        const rule = ENERGY_LEGAL_RULES[eq.energy_type];
        if (!rule) continue;

        const site = eq.client_sites as any;
        if (!site?.clients) continue;

        const client = site.clients;
        const legalRule = rule(client.region);
        if (!legalRule) continue;

        // Check if next_maintenance_date exists and if it's approaching or overdue
        if (!eq.next_maintenance_date) {
          // No scheduled date = needs attention
          alertList.push({
            clientId: client.id,
            clientName: client.name,
            region: client.region,
            equipmentName: eq.name,
            energyType: eq.energy_type,
            nextDueDate: "",
            requiredPeriodicity: legalRule.label,
            daysUntilDue: -999, // overdue
          });
          continue;
        }

        const dueDate = new Date(eq.next_maintenance_date);
        const days = differenceInDays(dueDate, now);

        // Show alerts for within 60 days or overdue
        if (days <= 60) {
          alertList.push({
            clientId: client.id,
            clientName: client.name,
            region: client.region,
            equipmentName: eq.name,
            energyType: eq.energy_type,
            nextDueDate: eq.next_maintenance_date,
            requiredPeriodicity: legalRule.label,
            daysUntilDue: days,
          });
        }
      }

      // Sort: most urgent first
      alertList.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
      setAlerts(alertList.slice(0, 8));
      setLoading(false);
    };

    fetchAlerts();
  }, []);

  const ENERGY_LABELS: Record<string, string> = {
    gaz: "Gaz", mazout: "Mazout", pellets: "Pellets",
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/entretiens")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            Alertes légales Belgique
          </CardTitle>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Chargement...</p>}
        {!loading && alerts.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune alerte légale</p>
        )}
        {alerts.map((a, i) => {
          const isOverdue = a.daysUntilDue < 0;
          const isUrgent = a.daysUntilDue <= 30 && a.daysUntilDue >= 0;
          return (
            <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{a.clientName}</div>
                <div className="text-xs text-muted-foreground">
                  {a.equipmentName} · {ENERGY_LABELS[a.energyType] || a.energyType} · {a.requiredPeriodicity}
                </div>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] ml-2 shrink-0 ${
                  isOverdue
                    ? "border-destructive text-destructive"
                    : isUrgent
                    ? "border-[hsl(var(--color-urgent))] text-[hsl(var(--color-urgent))]"
                    : ""
                }`}
              >
                {a.nextDueDate === ""
                  ? "Non planifié"
                  : isOverdue
                  ? `${Math.abs(a.daysUntilDue)}j retard`
                  : `${a.daysUntilDue}j`}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
