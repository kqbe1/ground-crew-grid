import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FILTER_TYPE_GROUPS, ENTRETIEN_SUBTYPES } from "@/lib/constants";
import CreateTaskDialog from "@/components/planning/CreateTaskDialog";
import { useWorkerLabels } from "@/hooks/useWorkerLabels";

const statusLabels: Record<string, string> = {
  planifie: "Planifié",
  termine: "Terminé",
  a_replanifier: "À replanifier",
  piece_a_commander: "Pièce à commander",
  sav: "SAV",
};

const statusColors: Record<string, string> = {
  planifie: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  termine: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  a_replanifier: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  piece_a_commander: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  sav: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const typeLabels: Record<string, string> = {
  entretien_gaz: "Entretien Gaz",
  entretien_mazout: "Entretien Mazout",
  entretien_pellets: "Entretien Pellets",
  entretien_clim: "Entretien Clim",
  entretien_vmc: "Entretien VMC",
  depannage: "Dépannage",
  installation: "Installation",
  remplacement: "Remplacement",
  rdv_divers: "RDV Divers",
  autre: "Autre",
};

export default function Taches() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const workerLabels = useWorkerLabels();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: tasks = [], refetch } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_tasks")
        .select("*, clients(name), profiles!work_tasks_assigned_to_fkey(full_name)")
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    let result = tasks;
    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }
    // Type filter
    if (typeFilter !== "all") {
      if (typeFilter === "entretien") {
        result = result.filter((t) => ENTRETIEN_SUBTYPES.includes(t.intervention_type));
      } else {
        result = result.filter((t) => t.intervention_type === typeFilter);
      }
    }
    // Search
    if (!search.trim()) return result;
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return result.filter((t) => {
      const haystack = [
        t.title,
        t.description,
        t.clients?.name,
        t.profiles?.full_name,
        statusLabels[t.status] || t.status,
        typeLabels[t.intervention_type] || t.intervention_type,
        t.memo_secretariat,
        t.material_needed,
        t.scheduled_date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [tasks, search, typeFilter, statusFilter]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">Tâches</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{filtered.length} tâche{filtered.length !== 1 ? "s" : ""}</span>
          <CreateTaskDialog defaultDate={new Date()} onCreated={() => refetch()} />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {FILTER_TYPE_GROUPS.map((g) => (
              <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Aucune tâche trouvée</div>
          ) : (
            filtered.map((task) => (
              <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/taches/${task.id}`)}>
                <CardContent className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    <Badge variant="outline" className={`${statusColors[task.status]} text-xs shrink-0 ml-2`}>
                      {statusLabels[task.status] || task.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{task.clients?.name || "—"}</span>
                    <span>{format(new Date(task.scheduled_date), "dd MMM yyyy", { locale: fr })}</span>
                  </div>
                  {task.profiles?.full_name && (
                    <p className="text-xs text-muted-foreground">
                      {workerLabels[task.assigned_to] && (
                        <span className="mr-1 rounded bg-muted px-1 py-[1px] text-[10px] font-bold text-foreground">
                          {workerLabels[task.assigned_to]}
                        </span>
                      )}
                      {task.profiles.full_name}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_150px_140px_120px_130px] gap-2 px-4 py-3 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span>Titre</span>
            <span>Client</span>
            <span>Type</span>
            <span>Statut</span>
            <span>Date prévue</span>
          </div>
          <div className="divide-y divide-border max-h-[calc(100vh-220px)] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">Aucune tâche trouvée</div>
            ) : (
              filtered.map((task) => (
                <button
                  key={task.id}
                  onClick={() => navigate(`/taches/${task.id}`)}
                  className="w-full grid grid-cols-[1fr_150px_140px_120px_130px] gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors text-sm"
                >
                  <div>
                    <p className="font-medium truncate">{task.title}</p>
                    {task.profiles?.full_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {workerLabels[task.assigned_to] && (
                          <span className="mr-1 rounded bg-muted px-1 py-[1px] text-[10px] font-bold text-foreground">
                            {workerLabels[task.assigned_to]}
                          </span>
                        )}
                        {task.profiles.full_name}
                      </p>
                    )}
                  </div>
                  <span className="truncate self-center">{task.clients?.name || "—"}</span>
                  <span className="truncate self-center text-muted-foreground">
                    {typeLabels[task.intervention_type] || task.intervention_type}
                  </span>
                  <div className="self-center">
                    <Badge variant="outline" className={statusColors[task.status]}>
                      {statusLabels[task.status] || task.status}
                    </Badge>
                  </div>
                  <span className="self-center text-muted-foreground">
                    {format(new Date(task.scheduled_date), "dd MMM yyyy", { locale: fr })}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
