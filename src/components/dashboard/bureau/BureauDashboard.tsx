import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { downloadFichesZip } from "@/lib/downloadFichesZip";
import { RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TASK_STATUS_LABELS, QUOTE_STATUS_LABELS, ENTRETIEN_SUBTYPES } from "@/lib/constants";
import { fetchQuotes, invalidateQuotesCache } from "@/lib/quotesQuery";
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

    // Fetch quotes (logique partagée avec la page Devis)
    let quotesRaw: any[] = [];
    try {
      quotesRaw = await fetchQuotes({ activeOnly: true });
    } catch (e) {
      quotesRaw = [];
    }

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

  // Realtime: refresh when quotes/sheets/tasks/orders change
  useEffect(() => {
    const channel = supabase
      .channel("bureau-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, () => {
        invalidateQuotesCache();
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "intervention_sheets" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "work_tasks" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "parts_orders" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

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
        <CommandeList search={searchClient} techFilter={techFilter} workers={workers} />
      ) : activeFilter === "dossier_en_cours" ? (
        <BureauDossierAccordion fiches={filteredFiches} onDelete={handleDelete} />
      ) : (
        <BureauFicheTable fiches={filteredFiches} onDelete={handleDelete} />
      )}
    </div>
  );
}

// Commande list aligned with BureauFicheTable styling
function CommandeList({ search, techFilter, workers }: { search: string; techFilter: string; workers: Worker[] }) {
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

  // Apply search & tech filters
  const filtered = orders.filter((o) => {
    if (search.trim()) {
      const q = normalizeSearch(search);
      const hay = `${o.clients?.name ?? ""} ${o.part_name ?? ""} ${o.supplier ?? ""} ${o.profiles?.full_name ?? ""}`;
      if (!normalizeSearch(hay).includes(q)) return false;
    }
    if (techFilter !== "all") {
      const w = workers.find((x) => x.id === techFilter);
      if (!w || o.profiles?.full_name !== w.full_name) return false;
    }
    return true;
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Type</TableHead>
            <TableHead>Pièce</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="hidden md:table-cell">Demandé par</TableHead>
            <TableHead className="w-[80px]">Qté</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune commande</TableCell></TableRow>
          )}
          {filtered.map((o) => (
            <TableRow
              key={o.id}
              className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition-colors"
              onClick={() => navigate(`/commandes/${o.id}`)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/commandes/${o.id}`);
                }
              }}
            >
              <TableCell>
                <Badge className="text-[10px] bg-purple-500 text-white">CMD</Badge>
              </TableCell>
              <TableCell>
                <div className="font-medium text-sm truncate max-w-[240px]">{o.part_name}</div>
                {o.supplier && <div className="text-xs text-muted-foreground truncate max-w-[240px]">{o.supplier}</div>}
              </TableCell>
              <TableCell className="text-sm">{o.clients?.name ?? "—"}</TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{o.profiles?.full_name ?? "—"}</TableCell>
              <TableCell className="text-sm">{o.quantity}</TableCell>
              <TableCell>
                <Badge className={`text-[10px] ${STATUS_BADGE[o.status] || ""}`}>
                  {o.status === "demandee" ? "Demandée" : "Commandée"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
