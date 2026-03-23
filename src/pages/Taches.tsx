import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import TaskDetailDialog from "@/components/planning/TaskDetailDialog";

const statusLabels: Record<string, string> = {
  planifie: "Planifié",
  termine: "Terminé",
  a_replanifier: "À replanifier",
  piece_a_commander: "Pièce à commander",
};

const statusColors: Record<string, string> = {
  planifie: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  termine: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  a_replanifier: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  piece_a_commander: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
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
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  const { data: tasks = [], refetch } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_tasks")
        .select("*, clients(name), profiles!work_tasks_assigned_to_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return tasks;
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return tasks.filter((t) => {
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
  }, [tasks, search]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tâches</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} tâche{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par client, titre, statut, type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

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
                onClick={() => setSelectedTask(task)}
                className="w-full grid grid-cols-[1fr_150px_140px_120px_130px] gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors text-sm"
              >
                <div>
                  <p className="font-medium truncate">{task.title}</p>
                  {task.profiles?.full_name && (
                    <p className="text-xs text-muted-foreground truncate">{task.profiles.full_name}</p>
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

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          onClose={() => { setSelectedTask(null); refetch(); }}
          onUpdated={() => refetch()}
        />
      )}
    </div>
  );
}
