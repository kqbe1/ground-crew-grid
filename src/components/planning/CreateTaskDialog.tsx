import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SIMPLIFIED_TYPES: Record<string, string> = {
  depannage: "Dépannage",
  entretien_gaz: "Entretien",
  installation: "Installation",
  rdv_divers: "RDV Divers",
  autre: "Autre",
};
import { Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { findOverlaps } from "@/lib/overlapUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CreateTaskDialogProps {
  defaultDate: Date;
  defaultHour?: number;
  defaultWorkerId?: string;
  onCreated: () => void;
}

export default function CreateTaskDialog({ defaultDate, defaultHour, defaultWorkerId, onCreated }: CreateTaskDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [interventionType, setInterventionType] = useState<string>("autre");
  const [assignedTo, setAssignedTo] = useState<string>(defaultWorkerId ?? "");
  const [scheduledDate, setScheduledDate] = useState(format(defaultDate, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(defaultHour ? `${String(defaultHour).padStart(2, "0")}:00` : "08:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [clientId, setClientId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [memoSecretariat, setMemoSecretariat] = useState("");

  const [workers, setWorkers] = useState<{ id: string; full_name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [existingTasks, setExistingTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      const [w, c] = await Promise.all([
        supabase.from("profiles").select("id, full_name").eq("is_active", true),
        supabase.from("clients").select("id, name").order("name"),
      ]);
      setWorkers(w.data ?? []);
      setClients(c.data ?? []);
    };
    fetchData();
  }, [open]);

  // Fetch tasks for the selected date to check overlaps
  useEffect(() => {
    if (!open || !scheduledDate) return;
    const fetchTasks = async () => {
      const { data } = await supabase
        .from("work_tasks")
        .select("id, assigned_to, scheduled_date, start_time, duration_minutes")
        .eq("scheduled_date", scheduledDate);
      setExistingTasks(data ?? []);
    };
    fetchTasks();
  }, [open, scheduledDate]);

  const overlaps = useMemo(() => {
    if (!assignedTo || !startTime) return [];
    return findOverlaps(assignedTo, scheduledDate, startTime, durationMinutes, existingTasks);
  }, [assignedTo, scheduledDate, startTime, durationMinutes, existingTasks]);

  // Reset defaults when dialog opens with new context
  useEffect(() => {
    if (open) {
      setScheduledDate(format(defaultDate, "yyyy-MM-dd"));
      if (defaultHour) setStartTime(`${String(defaultHour).padStart(2, "0")}:00`);
      if (defaultWorkerId) setAssignedTo(defaultWorkerId);
    }
  }, [open, defaultDate, defaultHour, defaultWorkerId]);

  const handleSubmit = async () => {
    if (!title.trim() || !user) {
      toast.error("Le titre est obligatoire");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("work_tasks").insert({
      title: title.trim(),
      intervention_type: interventionType as any,
      assigned_to: assignedTo || null,
      scheduled_date: scheduledDate,
      start_time: startTime,
      duration_minutes: durationMinutes,
      client_id: clientId || null,
      description: description || null,
      memo_secretariat: memoSecretariat || null,
      created_by: user.id,
      status: "planifie" as any,
    });
    setLoading(false);
    if (error) {
      toast.error("Erreur lors de la création: " + error.message);
      return;
    }
    toast.success("Tâche créée");
    setTitle("");
    setDescription("");
    setMemoSecretariat("");
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-create-task-trigger>
          <Plus className="w-4 h-4 mr-1" /> Nouvelle tâche
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une tâche</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Entretien chaudière gaz" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type d'intervention</Label>
              <Select value={interventionType} onValueChange={setInterventionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INTERVENTION_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigné à</Label>
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div>
              <Label>Heure de début</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label>Durée (min)</Label>
              <Input type="number" min={15} step={15} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
            </div>
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

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div>
            <Label>Mémo secrétariat</Label>
            <Textarea value={memoSecretariat} onChange={(e) => setMemoSecretariat(e.target.value)} rows={2} />
          </div>

          {overlaps.length > 0 && (
            <Alert variant="destructive" className="border-destructive/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                ⚠️ Chevauchement détecté : {overlaps.length} tâche{overlaps.length > 1 ? "s" : ""} sur ce créneau pour cet ouvrier.
              </AlertDescription>
            </Alert>
          )}

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "Création..." : overlaps.length > 0 ? "Créer malgré le chevauchement" : "Créer la tâche"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
