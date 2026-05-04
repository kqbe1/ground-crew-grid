import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Search, FolderOpen, ClipboardList, Wrench, FileText, Package, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import LayoutPage from "@/components/layout/LayoutPage";

interface ClientDossier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_intervention: string | null;
  fiches_count: number;
  entretiens_count: number;
  devis_count: number;
  commandes_count: number;
}

export default function Dossiers() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [dossiers, setDossiers] = useState<ClientDossier[]>([]);
  const [search, setSearch] = useState("");
  const [contentFilter, setContentFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(true);

  const fetchDossiers = useCallback(async () => {
    setLoading(true);

    // Fetch clients
    const clientQuery = supabase.from("clients").select("id, name, phone, email, address_intervention").order("name");
    if (search) clientQuery.ilike("name", `%${search}%`);
    const { data: clients } = await clientQuery;
    if (!clients || clients.length === 0) {
      setDossiers([]);
      setLoading(false);
      return;
    }

    const clientIds = clients.map((c) => c.id);

    // Fetch counts in parallel
    const [fichesRes, entretiensRes, devisRes, commandesRes] = await Promise.all([
      // Fiches: work_tasks with intervention_sheets
      supabase
        .from("work_tasks")
        .select("client_id, intervention_sheets!inner(id)", { count: "exact" })
        .in("client_id", clientIds)
        .not("client_id", "is", null),
      // Entretiens (maintenance_schedules)
      supabase
        .from("maintenance_schedules")
        .select("client_id")
        .in("client_id", clientIds),
      // Devis: match by client name (quotes don't have client_id FK)
      supabase
        .from("quotes")
        .select("id, client_name"),
      // Commandes
      supabase
        .from("parts_orders")
        .select("client_id")
        .in("client_id", clientIds)
        .not("client_id", "is", null),
    ]);

    // Count fiches per client
    const fichesMap = new Map<string, number>();
    (fichesRes.data ?? []).forEach((row: any) => {
      const cid = row.client_id;
      fichesMap.set(cid, (fichesMap.get(cid) ?? 0) + 1);
    });

    // Count entretiens per client
    const entretiensMap = new Map<string, number>();
    (entretiensRes.data ?? []).forEach((row: any) => {
      const cid = row.client_id;
      entretiensMap.set(cid, (entretiensMap.get(cid) ?? 0) + 1);
    });

    // Count devis by matching client_name to client name
    const clientNameMap = new Map<string, string>();
    clients.forEach((c) => clientNameMap.set(c.name.toLowerCase(), c.id));
    const devisMap = new Map<string, number>();
    (devisRes.data ?? []).forEach((row: any) => {
      const matchId = clientNameMap.get(row.client_name?.toLowerCase());
      if (matchId) {
        devisMap.set(matchId, (devisMap.get(matchId) ?? 0) + 1);
      }
    });

    // Count commandes per client
    const commandesMap = new Map<string, number>();
    (commandesRes.data ?? []).forEach((row: any) => {
      const cid = row.client_id;
      commandesMap.set(cid, (commandesMap.get(cid) ?? 0) + 1);
    });

    const result: ClientDossier[] = clients.map((c) => ({
      ...c,
      fiches_count: fichesMap.get(c.id) ?? 0,
      entretiens_count: entretiensMap.get(c.id) ?? 0,
      devis_count: devisMap.get(c.id) ?? 0,
      commandes_count: commandesMap.get(c.id) ?? 0,
    }));

    setDossiers(result);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchDossiers();
  }, [fetchDossiers]);

  const totalDocs = (d: ClientDossier) => d.fiches_count + d.entretiens_count + d.devis_count + d.commandes_count;

  const filtered = useMemo(() => {
    let result = [...dossiers];
    if (contentFilter !== "all") {
      if (contentFilter === "with") result = result.filter((d) => totalDocs(d) > 0);
      else if (contentFilter === "without") result = result.filter((d) => totalDocs(d) === 0);
      else if (contentFilter === "fiches") result = result.filter((d) => d.fiches_count > 0);
      else if (contentFilter === "entretiens") result = result.filter((d) => d.entretiens_count > 0);
      else if (contentFilter === "devis") result = result.filter((d) => d.devis_count > 0);
      else if (contentFilter === "commandes") result = result.filter((d) => d.commandes_count > 0);
    }
    if (sortBy === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "total_desc") result.sort((a, b) => totalDocs(b) - totalDocs(a));
    else if (sortBy === "total_asc") result.sort((a, b) => totalDocs(a) - totalDocs(b));
    return result;
  }, [dossiers, contentFilter, sortBy]);

  return (
    <LayoutPage
      icon={FolderOpen}
      title="Dossiers"
      subtitle={`${filtered.length} dossier${filtered.length > 1 ? "s" : ""}`}
      toolbar={
        <div className="flex items-center gap-3 flex-wrap w-full">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher un client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={contentFilter} onValueChange={setContentFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Contenu" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les dossiers</SelectItem>
              <SelectItem value="with">Avec documents</SelectItem>
              <SelectItem value="without">Sans documents</SelectItem>
              <SelectItem value="fiches">Avec fiches</SelectItem>
              <SelectItem value="entretiens">Avec entretiens</SelectItem>
              <SelectItem value="devis">Avec devis</SelectItem>
              <SelectItem value="commandes">Avec commandes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Trier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nom (A-Z)</SelectItem>
              <SelectItem value="total_desc">Plus de documents</SelectItem>
              <SelectItem value="total_asc">Moins de documents</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !isMobile ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-center">
                  <span className="flex items-center justify-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> Fiches</span>
                </TableHead>
                <TableHead className="text-center">
                  <span className="flex items-center justify-center gap-1"><Wrench className="w-3.5 h-3.5" /> Entretiens</span>
                </TableHead>
                <TableHead className="text-center">
                  <span className="flex items-center justify-center gap-1"><FileText className="w-3.5 h-3.5" /> Devis</span>
                </TableHead>
                <TableHead className="text-center">
                  <span className="flex items-center justify-center gap-1"><Package className="w-3.5 h-3.5" /> Commandes</span>
                </TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dossiers/${d.id}`)}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{d.name}</p>
                      {d.address_intervention && (
                        <p className="text-xs text-muted-foreground truncate max-w-[300px]">{d.address_intervention}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {d.fiches_count > 0 ? <Badge variant="secondary">{d.fiches_count}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {d.entretiens_count > 0 ? <Badge variant="secondary">{d.entretiens_count}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {d.devis_count > 0 ? <Badge variant="secondary">{d.devis_count}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {d.commandes_count > 0 ? <Badge variant="secondary">{d.commandes_count}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={totalDocs(d) > 0 ? "default" : "outline"}>{totalDocs(d)}</Badge>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Aucun dossier trouvé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <Card key={d.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/dossiers/${d.id}`)}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{d.name}</p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.fiches_count > 0 && <Badge variant="secondary" className="text-xs gap-1"><ClipboardList className="w-3 h-3" /> {d.fiches_count} fiche(s)</Badge>}
                  {d.entretiens_count > 0 && <Badge variant="secondary" className="text-xs gap-1"><Wrench className="w-3 h-3" /> {d.entretiens_count} entretien(s)</Badge>}
                  {d.devis_count > 0 && <Badge variant="secondary" className="text-xs gap-1"><FileText className="w-3 h-3" /> {d.devis_count} devis</Badge>}
                  {d.commandes_count > 0 && <Badge variant="secondary" className="text-xs gap-1"><Package className="w-3 h-3" /> {d.commandes_count} commande(s)</Badge>}
                  {totalDocs(d) === 0 && <span className="text-xs text-muted-foreground">Aucun document</span>}
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Aucun dossier trouvé
            </div>
          )}
        </div>
      )}
    </LayoutPage>
  );
}
