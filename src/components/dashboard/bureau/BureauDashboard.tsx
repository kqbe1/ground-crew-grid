import { useEffect, useState, useCallback } from "react";
import { downloadFichesZip } from "@/lib/downloadFichesZip";
import { RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TASK_STATUS_LABELS, QUOTE_STATUS_LABELS, ENTRETIEN_SUBTYPES } from "@/lib/constants";
import { normalizeSearch } from "@/lib/searchUtils";
import BureauFilterCards from "./BureauFilterCards";
import BureauReceivedBanner from "./BureauReceivedBanner";
import BureauFilterBar from "./BureauFilterBar";
import BureauFicheTable from "./BureauFicheTable";
import BureauDossierAccordion from "./BureauDossierAccordion";
import type { BureauFilterType, FicheType, UnifiedFiche } from "./types";

interface Worker { id: string; full_name: string; }

export default function BureauDashboard() {
  const [activeFilter, setActiveFilter] = useState<BureauFilterType>("received");
  const [typeFilter, setTypeFilter] = useState<FicheType | "all">("all");
  const [techFilter, setTechFilter] = useState("all");
  const [searchClient, setSearchClient] = useState("");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [allFiches, setAllFiches] = useState<UnifiedFiche[]>([]);
  const [counts, setCounts] = useState<Record<BureauFilterType, number>>({
    received: 0, en_attente: 0, dossier_en_cours: 0, commande: 0, sav: 0, cloturees: 0, devis: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch workers
    const { data: workersData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "ouvrier")
      .eq("is_active", true)
      .order("full_name");
    setWorkers(workersData ?? []);

    // Fetch intervention sheets with task & client info
    const { data: sheetsRaw } = await supabase
      .from("intervention_sheets")
      .select(`
        id, created_at, final_status, is_draft, entretien_type, arrival_time,
        worker_id,
        work_tasks!inner(title, intervention_type, scheduled_date, start_time, status,
          clients(id, name, address_intervention),
          assigned_to
        ),
        profiles:worker_id(full_name, worker_level)
      `)
      .eq("is_draft", false)
      .order("created_at", { ascending: false });

    // Fetch quotes
    const { data: quotesRaw } = await supabase
      .from("quotes")
      .select(`
        id, created_at, status, client_name, client_city, client_address,
        created_by,
        profiles:created_by(full_name, worker_level)
      `)
      .order("created_at", { ascending: false });

    // Fetch parts orders counts
    const { count: commandeCount } = await supabase
      .from("parts_orders")
      .select("id", { count: "exact" })
      .in("status", ["demandee", "commandee"]);

    // Build unified fiches
    const sheets: UnifiedFiche[] = (sheetsRaw ?? []).map((s: any) => {
      const task = s.work_tasks;
      const isEntretien = task?.intervention_type && ENTRETIEN_SUBTYPES.includes(task.intervention_type);
      const ficheType: FicheType = isEntretien ? "FE" : "FI";
      return {
        id: s.id,
        type: ficheType,
        clientName: task?.clients?.name ?? "—",
        clientCity: extractCity(task?.clients?.address_intervention),
        clientId: task?.clients?.id ?? null,
        techName: s.profiles?.full_name ?? "—",
        techLevel: s.profiles?.worker_level ?? null,
        date: s.created_at,
        time: s.arrival_time ? new Date(s.arrival_time).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }) : null,
        status: s.final_status,
        statusLabel: TASK_STATUS_LABELS[s.final_status] ?? s.final_status,
        sourceTable: "intervention_sheets",
        _taskStatus: task?.status,
      } as UnifiedFiche & { _taskStatus?: string };
    });

    const quotes: UnifiedFiche[] = (quotesRaw ?? []).map((q: any) => ({
      id: q.id,
      type: "FD" as FicheType,
      clientName: q.client_name ?? "—",
      clientCity: q.client_city ?? extractCity(q.client_address),
      clientId: null,
      techName: q.profiles?.full_name ?? "—",
      techLevel: q.profiles?.worker_level ?? null,
      date: q.created_at,
      time: null,
      status: q.status,
      statusLabel: QUOTE_STATUS_LABELS[q.status] ?? q.status,
      sourceTable: "quotes",
    }));

    const all = [...sheets, ...quotes];
    setAllFiches(all);

    // Compute counts
    const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const receivedCount = all.filter((f) => f.date >= now24h).length;

    const enAttenteCount = all.filter((f) => {
      if (f.sourceTable === "quotes") return f.status === "en_attente";
      return (f as any)._taskStatus === "a_replanifier" || f.status === "a_replanifier";
    }).length;

    // Dossier en cours: clients with active tasks/orders
    const dossierClients = new Set<string>();
    sheets.forEach((s: any) => {
      if (s.clientId && ((s as any)._taskStatus === "planifie" || (s as any)._taskStatus === "piece_a_commander")) {
        dossierClients.add(s.clientId);
      }
    });
    const dossierCount = dossierClients.size;

    const savCount = all.filter((f) => f.status === "sav").length;
    const clotureeCount = all.filter((f) => f.status === "termine" || f.status === "cloture").length;
    const devisCount = quotes.length;

    setCounts({
      received: receivedCount,
      en_attente: enAttenteCount,
      dossier_en_cours: dossierCount,
      commande: commandeCount ?? 0,
      sav: savCount,
      cloturees: clotureeCount,
      devis: devisCount,
    });

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Apply filters
  const getFilteredFiches = (): UnifiedFiche[] => {
    let result = allFiches;

    // Primary filter (card or banner)
    const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    switch (activeFilter) {
      case "received":
        result = result.filter((f) => f.date >= now24h);
        break;
      case "en_attente":
        result = result.filter((f) => {
          if (f.sourceTable === "quotes") return f.status === "en_attente";
          return (f as any)._taskStatus === "a_replanifier" || f.status === "a_replanifier";
        });
        break;
      case "dossier_en_cours": {
        const dossierClients = new Set<string>();
        allFiches.forEach((f: any) => {
          if (f.clientId && f.sourceTable === "intervention_sheets" && (f._taskStatus === "planifie" || f._taskStatus === "piece_a_commander")) {
            dossierClients.add(f.clientId);
          }
        });
        result = result.filter((f) => f.clientId && dossierClients.has(f.clientId));
        break;
      }
      case "commande":
        // This filter shows parts_orders, not fiches - handled separately
        result = [];
        break;
      case "sav":
        result = result.filter((f) => f.status === "sav");
        break;
      case "cloturees":
        result = result.filter((f) => f.status === "termine" || f.status === "cloture");
        break;
      case "devis":
        result = result.filter((f) => f.sourceTable === "quotes");
        break;
    }

    // Type filter
    if (typeFilter !== "all") result = result.filter((f) => f.type === typeFilter);

    // Tech filter
    if (techFilter !== "all") result = result.filter((f) => {
      // Match by worker name since we have the name, not ID in unified fiche
      const worker = workers.find((w) => w.id === techFilter);
      return worker && f.techName === worker.full_name;
    });

    // Search
    if (searchClient.trim()) {
      const q = normalizeSearch(searchClient);
      result = result.filter((f) => normalizeSearch(f.clientName).includes(q));
    }

    return result;
  };

  const filteredFiches = getFilteredFiches();
  const totalCount = filteredFiches.length;

  const handleCardSelect = (key: BureauFilterType) => {
    setActiveFilter(key);
  };

  const handleBannerClick = () => {
    setActiveFilter("received");
  };

  const handleDelete = async (fiche: UnifiedFiche) => {
    const table = fiche.sourceTable === "quotes" ? "quotes" : "intervention_sheets";
    const { error } = await supabase.from(table).delete().eq("id", fiche.id);
    if (error) toast.error("Erreur lors de la suppression");
    else {
      toast.success("Fiche supprimée");
      fetchData();
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Tableau de bord
            <span className="text-muted-foreground font-normal ml-2">— {totalCount} fiche{totalCount !== 1 ? "s" : ""}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={filteredFiches.length === 0 || loading} onClick={async () => {
            toast.info("Génération du ZIP en cours…");
            try {
              await downloadFichesZip(filteredFiches);
              toast.success("ZIP téléchargé !");
            } catch (e) { toast.error("Erreur lors de la génération du ZIP"); }
          }}>
            <Download className="w-4 h-4 mr-1" />Télécharger ZIP
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />Actualiser
          </Button>
        </div>
      </div>

      {/* Filter cards */}
      <BureauFilterCards
        active={activeFilter !== "received" ? activeFilter : null}
        counts={counts}
        onSelect={handleCardSelect}
      />

      {/* Received banner */}
      <BureauReceivedBanner
        active={activeFilter === "received"}
        count={counts.received}
        onClick={handleBannerClick}
      />

      {/* Filter bar */}
      <BureauFilterBar
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        techFilter={techFilter}
        onTechChange={setTechFilter}
        searchClient={searchClient}
        onSearchChange={setSearchClient}
        workers={workers}
      />

      {/* Content */}
      {activeFilter === "commande" ? (
        <CommandeList />
      ) : activeFilter === "dossier_en_cours" ? (
        <BureauDossierAccordion fiches={filteredFiches} onDelete={handleDelete} />
      ) : (
        <BureauFicheTable fiches={filteredFiches} onDelete={handleDelete} />
      )}
    </div>
  );
}

// Simple commande list when "Commande" card is active
function CommandeList() {
  const [orders, setOrders] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("parts_orders")
      .select("id, part_name, status, urgency, quantity, supplier, clients(name), profiles:requested_by(full_name)")
      .in("status", ["demandee", "commandee"])
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders(data ?? []));
  }, []);

  const STATUS_BADGE: Record<string, string> = {
    demandee: "bg-amber-500 text-white",
    commandee: "bg-purple-500 text-white",
  };

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2 font-medium">Pièce</th>
            <th className="text-left px-4 py-2 font-medium">Client</th>
            <th className="text-left px-4 py-2 font-medium">Demandé par</th>
            <th className="text-left px-4 py-2 font-medium">Statut</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 && (
            <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Aucune commande en cours</td></tr>
          )}
          {orders.map((o) => (
            <tr
              key={o.id}
              className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
              onClick={() => navigate(`/commandes/${o.id}`)}
            >
              <td className="px-4 py-2 font-medium">{o.part_name}</td>
              <td className="px-4 py-2 text-muted-foreground">{o.clients?.name ?? "—"}</td>
              <td className="px-4 py-2 text-muted-foreground">{o.profiles?.full_name ?? "—"}</td>
              <td className="px-4 py-2">
                <Badge className={`text-[10px] ${STATUS_BADGE[o.status] || ""}`}>
                  {o.status === "demandee" ? "Demandée" : "Commandée"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function extractCity(address: string | null | undefined): string {
  if (!address) return "";
  // Try to extract city from Belgian-style address (last part after comma or postal code)
  const parts = address.split(",").map((s) => s.trim());
  if (parts.length > 1) return parts[parts.length - 1];
  // Try postal code pattern
  const match = address.match(/\d{4}\s+(.+)/);
  return match ? match[1] : "";
}
