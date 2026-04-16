import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TASK_STATUS_LABELS, INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Loader2, Trash2, Pencil, Clock, User, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  planifie: "bg-[hsl(var(--color-planifie))]",
  termine: "bg-[hsl(var(--color-termine))]",
  a_replanifier: "bg-[hsl(var(--color-replanifier))]",
  piece_a_commander: "bg-[hsl(var(--color-piece))]",
  sav: "bg-[hsl(var(--color-sav))]",
};

const ALL_STATUSES = ["termine", "a_replanifier", "piece_a_commander", "sav", "planifie"] as const;

const SIMPLIFIED_INTERVENTION_LABELS: Record<string, string> = {
  depannage: "Dépannage", entretien: "Entretien", installation: "Installation",
  rdv_divers: "RDV Divers", autre: "Autre",
};
const SIMPLIFIED_TO_ENUM: Record<string, string> = {
  depannage: "depannage", entretien: "entretien_gaz", installation: "installation",
  rdv_divers: "rdv_divers", autre: "autre",
};
function toSimplifiedKey(enumVal: string): string {
  if (enumVal.startsWith("entretien_")) return "entretien";
  if (enumVal === "remplacement") return "installation";
  return enumVal;
}

export default function TacheDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "bureau" || role === "super_admin";

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit fields
  const [title, setTitle] = useState("");
  const [interventionType, setInterventionType] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [secondAssignedTo, setSecondAssignedTo] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [clientId, setClientId] = useState("");
  const [description, setDescription] = useState("");
  const [memoSecretariat, setMemoSecretariat] = useState("");

  const [workers, setWorkers] = useState<{ id: string; full_name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  const fetchTask = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("work_tasks")
      .select("*, clients(name, address_intervention, phone, email), profiles!work_tasks_assigned_to_fkey(full_name), client_sites(address)")
      .eq("id", id)
      .single();
    setTask(data);
    if (data) {
      setTitle(data.title ?? "");
      setInterventionType(data.intervention_type ?? "autre");
      setAssignedTo(data.assigned_to ?? "");
      setSecondAssignedTo(data.second_assigned_to ?? "");
      setScheduledDate(data.scheduled_date ?? "");
      setStartTime(data.start_time?.slice(0, 5) ?? "08:00");
      setDurationMinutes(data.duration_minutes ?? 60);
      setClientId(data.client_id ?? "");
      setDescription(data.description ?? "");
      setMemoSecretariat(data.memo_secretariat ?? "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchTask(); }, [fetchTask]);

  useEffect(() => {
    if (!canEdit) return;
    const fetchData = async () => {
      const [w, c] = await Promise.all([
        supabase.from("profiles").select("id, full_name").eq("is_active", true),
        supabase.from("clients").select("id, name").order("name"),
      ]);
      setWorkers(w.data ?? []);
      setClients(c.data ?? []);
    };
    fetchData();
  }, [canEdit]);

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("work_tasks").update({ status: status as any }).eq("id", id!);
    if (error) { toast.error(error.message); return; }
    toast.success(`Statut → ${TASK_STATUS_LABELS[status]}`);
    fetchTask();
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("work_tasks").update({
      title,
      intervention_type: interventionType as any,
      assigned_to: assignedTo || null,
      second_assigned_to: (secondAssignedTo && secondAssignedTo !== "none") ? secondAssignedTo : null,
      scheduled_date: scheduledDate,
      start_time: startTime,
      duration_minutes: durationMinutes,
      client_id: clientId || null,
      description: description || null,
      memo_secretariat: memoSecretariat || null,
    }).eq("id", id!);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tâche mise à jour");
    setEditing(false);
    fetchTask();
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("work_tasks").delete().eq("id", id!);
    if (error) { toast.error(error.message); return; }
    toast.success("Tâche supprimée");
    navigate(-1);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!task) return <div className="p-6 text-center text-muted-foreground">Tâche introuvable</div>;

  const interventionLabel = INTERVENTION_TYPE_LABELS[task.intervention_type] || task.intervention_type;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{task.title}</h1>
              <p className="text-sm text-muted-foreground">
                {task.clients?.name || "—"} · {task.profiles?.full_name || "Non assigné"} · {format(new Date(task.scheduled_date), "d MMMM yyyy", { locale: fr })}
              </p>
            </div>
            {task.intervention_type && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INTERVENTION_TYPE_COLORS[task.intervention_type] || ""} hidden sm:inline`}>
                {interventionLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && !editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4 mr-1" /> Modifier
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Retour
            </Button>
          </div>
        </div>

        {/* Status buttons */}
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={task.status === s ? "default" : "outline"}
              className={task.status === s ? `${statusColor[s]} text-white` : ""}
              onClick={() => updateStatus(s)}
            >
              {TASK_STATUS_LABELS[s]}
            </Button>
          ))}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive"><Trash2 className="w-4 h-4 mr-1" /> Supprimer</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Separator />

      {!editing ? (
        /* View mode */
        <div className="space-y-6">
          {/* Schedule info */}
          <section className="space-y-2">
            <h2 className="font-semibold text-sm">Planification</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Date</div>
                  <div className="font-medium">{format(new Date(task.scheduled_date), "dd/MM/yyyy")}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Heure</div>
                  <div className="font-medium">{task.start_time?.slice(0, 5)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Durée</div>
                  <div className="font-medium">{task.duration_minutes} min</div>
                </div>
              </div>
            </div>
          </section>

          {/* Worker */}
          <section className="space-y-2">
            <h2 className="font-semibold text-sm">Ouvrier</h2>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <User className="w-4 h-4 text-muted-foreground" />
              <div className="font-medium">{task.profiles?.full_name || "Non assigné"}</div>
            </div>
          </section>

          {/* Client */}
          {task.clients && (
            <section className="space-y-2">
              <h2 className="font-semibold text-sm">Client</h2>
              <div className="p-4 rounded-lg border text-sm space-y-1">
                <p className="font-medium">{task.clients.name}</p>
                {task.clients.address_intervention && <p className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {task.clients.address_intervention}</p>}
                {task.client_sites?.address && <p className="text-muted-foreground">Site : {task.client_sites.address}</p>}
                {task.clients.phone && <p className="text-muted-foreground">📞 {task.clients.phone}</p>}
                {task.clients.email && <p className="text-muted-foreground">✉️ {task.clients.email}</p>}
              </div>
            </section>
          )}

          {/* Description */}
          {task.description && (
            <section className="space-y-2">
              <h2 className="font-semibold text-sm">Description</h2>
              <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{task.description}</p>
            </section>
          )}

          {/* Material needed */}
          {task.material_needed && (
            <section className="space-y-2">
              <h2 className="font-semibold text-sm">Matériel nécessaire</h2>
              <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{task.material_needed}</p>
            </section>
          )}

          {/* Memo */}
          {task.memo_secretariat && (
            <section className="space-y-2">
              <h2 className="font-semibold text-sm">Mémo secrétariat</h2>
              <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{task.memo_secretariat}</p>
            </section>
          )}
        </div>
      ) : (
        /* Edit mode */
        <div className="space-y-4">
          <div>
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={toSimplifiedKey(interventionType)} onValueChange={(v) => setInterventionType(SIMPLIFIED_TO_ENUM[v] || v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SIMPLIFIED_INTERVENTION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ouvrier principal</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Non assigné" /></SelectTrigger>
                <SelectContent>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Second ouvrier / apprenti</Label>
              <Select value={secondAssignedTo} onValueChange={setSecondAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div>
              <Label>Heure</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label>Durée (min)</Label>
              <Input type="number" min={15} step={15} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div>
            <Label>Mémo secrétariat</Label>
            <Textarea value={memoSecretariat} onChange={(e) => setMemoSecretariat(e.target.value)} rows={2} />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Sauvegarde..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
