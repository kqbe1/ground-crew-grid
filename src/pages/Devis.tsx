import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { INSTALLATION_TYPE_LABELS } from "@/lib/constants";
import { fetchQuotes, filterQuotes, QUOTE_STATUS_LABELS, invalidateQuotesCache, quotesToCsv } from "@/lib/quotesQuery";
import QuoteStatusBadge from "@/components/devis/QuoteStatusBadge";
import { useRealtimeQuotes } from "@/hooks/useRealtimeQuotes";
import { FileText, Search, Trash2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import LayoutPage from "@/components/layout/LayoutPage";

export default function Devis() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [installationFilter, setInstallationFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const isMobile = useIsMobile();

  const loadQuotes = async (force = false) => {
    try {
      const data = await fetchQuotes({ force });
      setQuotes(data);
    } catch {
      setQuotes([]);
    }
  };

  const fetchWorkers = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name").in("role", ["ouvrier", "admin"]).order("full_name");
    setWorkers(data ?? []);
  };

  useEffect(() => { loadQuotes(); fetchWorkers(); }, []);

  // Realtime robuste : reconnexion auto + rattrapage cache à chaque resync
  useRealtimeQuotes({
    channelName: "devis-list",
    onChange: () => loadQuotes(true),
  });

  const filtered = useMemo(
    () => filterQuotes(quotes, {
      status: statusFilter,
      createdBy: workerFilter,
      installationType: installationFilter,
      search,
    }),
    [quotes, statusFilter, workerFilter, installationFilter, search],
  );

  // Reset page si les filtres changent
  useEffect(() => { setPage(1); }, [statusFilter, workerFilter, installationFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleExportCsv = () => {
    if (filtered.length === 0) { toast.info("Aucun devis à exporter"); return; }
    const csv = quotesToCsv(filtered);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `devis-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} devis exportés`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Supprimer ce devis ?")) return;
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    invalidateQuotesCache();
    toast.success("Devis supprimé");
    loadQuotes(true);
  };

  return (
    <LayoutPage
      icon={FileText}
      title="Devis"
      subtitle={`${filtered.length} devis`}
      actions={
        <Button variant="outline" onClick={handleExportCsv} disabled={filtered.length === 0}>
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      }
      toolbar={
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(QUOTE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={installationFilter} onValueChange={setInstallationFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Installation" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes installations</SelectItem>
            {Object.entries(INSTALLATION_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={workerFilter} onValueChange={setWorkerFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Technicien" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        </div>
      }
    >
      <div className="space-y-2">
        {paginated.map((quote) => (
          <Card key={quote.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/devis/${quote.id}`)}>
            <CardContent className={cn("py-3", isMobile ? "space-y-2" : "flex items-center gap-3")}>
              {isMobile ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-rose-500 text-white text-[10px]">+FD</Badge>
                      <span className="font-medium text-sm">{quote.client_name}</span>
                    </div>
                    <QuoteStatusBadge status={quote.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{INSTALLATION_TYPE_LABELS[quote.installation_type]}</span>
                    <span>{quote.client_city}</span>
                    <span>{format(new Date(quote.created_at), "d MMM yyyy", { locale: fr })}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{quote.profiles?.full_name}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleDelete(e, quote.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 rounded-lg bg-rose-500/10"><FileText className="w-4 h-4 text-rose-500" /></div>
                  <Badge className="bg-rose-500 text-white text-[10px]">+FD</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{quote.client_name}</div>
                    <div className="text-sm text-muted-foreground">{INSTALLATION_TYPE_LABELS[quote.installation_type]} · {quote.profiles?.full_name}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">{quote.client_city}</div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(quote.created_at), "d MMM yyyy HH:mm", { locale: fr })}</div>
                  <QuoteStatusBadge status={quote.status} />
                  <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, quote.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground">Aucun devis</div>}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} sur {filtered.length}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">Page {currentPage} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </LayoutPage>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
