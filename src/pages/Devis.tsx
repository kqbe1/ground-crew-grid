import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS, INSTALLATION_TYPE_LABELS } from "@/lib/constants";
import { FileText, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Devis() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const isMobile = useIsMobile();

  const fetchQuotes = async () => {
    const { data } = await supabase.from("quotes").select("*, profiles!quotes_created_by_fkey(full_name)").order("created_at", { ascending: false });
    setQuotes(data ?? []);
  };

  const fetchWorkers = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name").in("role", ["ouvrier", "admin"]).order("full_name");
    setWorkers(data ?? []);
  };

  useEffect(() => { fetchQuotes(); fetchWorkers(); }, []);

  const filtered = quotes.filter((q) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (workerFilter !== "all" && q.created_by !== workerFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!q.client_name?.toLowerCase().includes(s) && !q.client_city?.toLowerCase().includes(s) && !q.profiles?.full_name?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Supprimer ce devis ?")) return;
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    toast.success("Devis supprimé");
    fetchQuotes();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Devis</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} devis</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
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
        <Select value={workerFilter} onValueChange={setWorkerFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Technicien" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map((quote) => (
          <Card key={quote.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/devis/${quote.id}`)}>
            <CardContent className={cn("py-3", isMobile ? "space-y-2" : "flex items-center gap-3")}>
              {isMobile ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-rose-500 text-white text-[10px]">+FD</Badge>
                      <span className="font-medium text-sm">{quote.client_name}</span>
                    </div>
                    <Badge className={`${QUOTE_STATUS_COLORS[quote.status]} text-white text-xs`}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
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
                  <Badge className={`${QUOTE_STATUS_COLORS[quote.status]} text-white text-xs`}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
                  <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, quote.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground">Aucun devis</div>}
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
