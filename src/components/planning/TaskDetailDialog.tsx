import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import { useWorkerLabels } from "@/hooks/useWorkerLabels";
import { computeEndTime, computeDurationMinutes } from "@/lib/timeRange";
import ClientCombobox from "@/components/forms/ClientCombobox";

const SIMPLIFIED_INTERVENTION_LABELS: Record<string, string> = {
  depannage: "Dépannage",
  entretien: "Entretien",
  installation: "Installation",
  rdv_divers: "RDV Divers",
  autre: "Autre",
};

// Map simplified selection back to actual enum values
const SIMPLIFIED_TO_ENUM: Record<string, string> = {
  depannage: "depannage",
  entretien: "entretien_gaz",
  installation: "installation",
  rdv_divers: "rdv_divers",
  autre: "autre",
};

// Map existing enum values to simplified key for display
function toSimplifiedKey(enumVal: string): string {
  if (enumVal.startsWith("entretien_")) return "entretien";
  if (enumVal === "remplacement") return "installation";
  return enumVal;
}
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TaskDetailDialogProps {
  task: any | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function TaskDetailDialog({ task, onClose, onUpdated }: TaskDetailDialogProps) {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "bureau" || role === "super_admin";
  const workerLabels = useWorkerLabels();

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState("");
  const [interventionType, setInterventionType] = useState("");
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [secondAssignedTo, setSecondAssignedTo] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [endTime, setEndTime] = useState("");
  const [clientId, setClientId] = useState("");
  const [description, setDescription] = useState("");
  const [memoSecretariat, setMemoSecretariat] = useState("");

  const [workers, setWorkers] = useState<{ id: string; full_name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; address_intervention?: string | null }[]>([]);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? "");
    setInterventionType(task.intervention_type ?? "autre");
    setStatus(task.status ?? "planifie");
    setAssignedTo(task.assigned_to ?? "");
    setSecondAssignedTo(task.second_assigned_to ?? "");
    setScheduledDate(task.scheduled_date ?? "");
    const st = task.start_time?.slice(0, 5) ?? "08:00";
    const dur = task.duration_minutes ?? 60;
    setStartTime(st);
    setDurationMinutes(dur);
    setEndTime(computeEndTime(st, dur));
    setClientId(task.client_id ?? "");
    setDescription(task.description ?? "");
    setMemoSecretariat(task.memo_secretariat ?? "");
    setEditing(false);
  }, [task]);

  useEffect(() => {
    if (!task || !canEdit) return;
    const fetchData = async () => {
      const [w, c] = await Promise.all([
        supabase.from("profiles").select("id, full_name").eq("is_active", true),
        supabase.from("clients").select("id, name, address_intervention").order("name"),
      ]);
      setWorkers(w.data ?? []);
      setClients(c.data ?? []);
    };
    fetchData();
  }, [task, canEdit]);

  const handleSave = async () => {
    if (!task) return;
    setLoading(true);
    const { error } = await supabase.from("work_tasks").update({
      title,
      intervention_type: interventionType as any,
      status: status as any,
      assigned_to: assignedTo || null,
      second_assigned_to: (secondAssignedTo && secondAssignedTo !== "none") ? secondAssignedTo : null,
      scheduled_date: scheduledDate,
      start_time: startTime,
      duration_minutes: durationMinutes,
      client_id: clientId || null,
      description: description || null,
      memo_secretariat: memoSecretariat || null,
    }).eq("id", task.id);
    setLoading(false);
    if (error) {
      toast.error("Erreur: " + error.message);
      return;
    }
    toast.success("Tâche mise à jour");
    setEditing(false);
    onUpdated();
  };

  const handleDelete = async () => {
    if (!task) return;
    setDeleting(true);
    const { error } = await supabase.from("work_tasks").delete().eq("id", task.id);
    setDeleting(false);
    if (error) {
      toast.error("Erreur: " + error.message);
      return;
    }
    toast.success("Tâche supprimée");
    onClose();
    onUpdated();
  };

  if (!task) return null;

  return (
    <Dialog open={!!task} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Détail de la tâche
            <Badge variant="outline">{TASK_STATUS_LABELS[task.status] ?? task.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        {!editing ? (
          <div className="space-y-3">
            <div>
              <span className="text-sm text-muted-foreground">Titre</span>
              <p className="font-medium">{task.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-sm text-muted-foreground">Type</span>
                <p>{SIMPLIFIED_INTERVENTION_LABELS[toSimplifiedKey(task.intervention_type)] ?? task.intervention_type}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Assigné à</span>
                <p className="flex items-center gap-1.5">
                  {workerLabels[task.assigned_to] && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold border border-border">
                      {workerLabels[task.assigned_to]}
                    </span>
                  )}
                  {task.profiles?.full_name ?? "Non assigné"}
                </p>
                {task.second_assigned_to && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold border border-border">
                      {workerLabels[task.second_assigned_to] ?? "T?"}
                    </span>
                    Binôme
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-sm text-muted-foreground">Date</span>
                <p>{task.scheduled_date}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Heure</span>
                <p>{task.start_time?.slice(0, 5)}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Heure de fin</span>
                <p>{computeEndTime(task.start_time?.slice(0, 5) ?? "", task.duration_minutes ?? 0)}</p>
              </div>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Client</span>
              <p>{task.clients?.name ?? "—"}</p>
            </div>
            {task.description && (
              <div>
                <span className="text-sm text-muted-foreground">Description</span>
                <p className="text-sm">{task.description}</p>
              </div>
            )}
            {task.memo_secretariat && (
              <div>
                <span className="text-sm text-muted-foreground">Mémo secrétariat</span>
                <p className="text-sm">{task.memo_secretariat}</p>
              </div>
            )}

            {canEdit && (
              <div className="flex gap-2">
                <Button onClick={() => setEditing(true)} className="flex-1">Modifier</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. La tâche « {task.title} » sera définitivement supprimée.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {deleting ? "Suppression..." : "Supprimer"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        ) : (
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
                      <SelectItem key={k} value={k === "entretien_gaz" ? "entretien" : k}>{v as string}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ouvrier principal</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="Non assigné" /></SelectTrigger>
                  <SelectContent>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {workerLabels[w.id] ? `${workerLabels[w.id]} · ` : ""}{w.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Second ouvrier / apprenti</Label>
                <Select value={secondAssignedTo} onValueChange={setSecondAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {workerLabels[w.id] ? `${workerLabels[w.id]} · ` : ""}{w.full_name}
                      </SelectItem>
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
                <Label>Heure de début</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartTime(v);
                    setDurationMinutes(computeDurationMinutes(v, endTime));
                  }}
                />
              </div>
              <div>
                <Label>Heure de fin</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEndTime(v);
                    setDurationMinutes(computeDurationMinutes(startTime, v));
                  }}
                />
              </div>
            </div>

            <div>
              <Label>Client</Label>
              <ClientCombobox clients={clients} value={clientId} onChange={setClientId} placeholder="Rechercher un client..." />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>

            <div>
              <Label>Mémo secrétariat</Label>
              <Textarea value={memoSecretariat} onChange={(e) => setMemoSecretariat(e.target.value)} rows={2} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">Annuler</Button>
              <Button onClick={handleSave} disabled={loading} className="flex-1">
                {loading ? "Sauvegarde..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
