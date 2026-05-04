import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSearch } from "@/lib/searchUtils";
import { TASK_STATUS_LABELS, INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS, FILTER_TYPE_GROUPS, ENTRETIEN_SUBTYPES } from "@/lib/constants";
import { FileSignature, Camera, Mail, Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import CreateTaskDialog from "@/components/planning/CreateTaskDialog";
import { useWorkerLabels } from "@/hooks/useWorkerLabels";

export default function Fiches() {
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [workers, setWorkers] = useState<{ id: string; full_name: string }[]>([]);
  const workerLabels = useWorkerLabels();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("full_name", { ascending: true });
      setWorkers(data ?? []);
    })();
  }, []);

  const fetchSheets = async () => {
    const { data } = await supabase
      .from("intervention_sheets")
      .select("*, work_tasks(title, intervention_type, clients(name, email)), profiles!intervention_sheets_worker_id_fkey(full_name)")
      .order("created_at", { ascending: false });
    setSheets(data ?? []);
  };

  useEffect(() => { fetchSheets(); }, []);

  const filtered = sheets.filter((s) => {
    if (statusFilter !== "all" && s.final_status !== statusFilter) return false;
    if (workerFilter !== "all" && s.worker_id !== workerFilter) return false;
    if (typeFilter !== "all") {
      if (typeFilter === "entretien") {
        if (!ENTRETIEN_SUBTYPES.includes(s.work_tasks?.intervention_type)) return false;
      } else if (s.work_tasks?.intervention_type !== typeFilter) return false;
    }
    if (search) {
      const q = normalizeSearch(search);
      const match =
        normalizeSearch(s.work_tasks?.title).includes(q) ||
        normalizeSearch(s.work_tasks?.clients?.name).includes(q) ||
        normalizeSearch(s.profiles?.full_name).includes(q);
      if (!match) return false;
    }
    return true;
  });

  const statusColor: Record<string, string> = {
    planifie: "bg-[hsl(var(--color-planifie))]",
    termine: "bg-[hsl(var(--color-termine))]",
    a_replanifier: "bg-[hsl(var(--color-replanifier))]",
    piece_a_commander: "bg-[hsl(var(--color-piece))]",
    sav: "bg-[hsl(var(--color-sav))]",
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Fiches d'intervention</h1>
          <p className="text-muted-foreground">{filtered.length} fiche(s)</p>
        </div>
        <CreateTaskDialog defaultDate={new Date()} onCreated={() => fetchSheets()} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {FILTER_TYPE_GROUPS.map((g) => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={workerFilter} onValueChange={setWorkerFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Ouvrier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les ouvriers</SelectItem>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {workerLabels[w.id] ? `${workerLabels[w.id]} · ` : ""}{w.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((sheet) => {
          const intType = sheet.work_tasks?.intervention_type;
          return (
            <Card key={sheet.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/fiches/${sheet.id}`)}>
              <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                  {(() => {
                    const isEntretien = intType?.startsWith("entretien_");
                    const badgeType = isEntretien ? "+FE" : "+FI";
                    const badgeColor = isEntretien ? "bg-blue-500" : "bg-primary";
                    return <Badge className={`${badgeColor} text-white shrink-0 text-[10px] px-1.5`}>{badgeType}</Badge>;
                  })()}
                  <div className="min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                      {sheet.work_tasks?.title}
                      {intType && <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${INTERVENTION_TYPE_COLORS[intType]}`}>{INTERVENTION_TYPE_LABELS[intType]}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{sheet.work_tasks?.clients?.name}</span>
                      <span>·</span>
                      {sheet.worker_id && workerLabels[sheet.worker_id] && (
                        <span className="rounded bg-muted px-1 py-[1px] text-[10px] font-bold text-foreground">
                          {workerLabels[sheet.worker_id]}
                        </span>
                      )}
                      <span>{sheet.profiles?.full_name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {sheet.sent_to_client && <div className="p-1 rounded bg-[hsl(var(--color-termine))]/10" title="Envoyé"><Mail className="w-3.5 h-3.5 text-[hsl(var(--color-termine))]" /></div>}
                  {sheet.signature_data && <div className="p-1 rounded bg-[hsl(var(--color-termine))]/10" title="Signé"><FileSignature className="w-3.5 h-3.5 text-[hsl(var(--color-termine))]" /></div>}
                  {(sheet.photos_before?.length > 0 || sheet.photos_after?.length > 0) && <div className="p-1 rounded bg-primary/10" title="Photos"><Camera className="w-3.5 h-3.5 text-primary" /></div>}
                  {sheet.is_draft && <Badge variant="outline" className="border-dashed text-xs">Brouillon</Badge>}
                  <Badge className={`${statusColor[sheet.final_status]} text-white text-xs`}>{TASK_STATUS_LABELS[sheet.final_status]}</Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(sheet.created_at), "d MMM yyyy", { locale: fr })}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground">Aucune fiche d'intervention</div>}
      </div>
    </div>
  );
}
