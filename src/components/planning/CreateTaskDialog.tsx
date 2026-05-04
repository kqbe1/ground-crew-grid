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
import { computeEndTime, computeDurationMinutes } from "@/lib/timeRange";
import ClientCombobox from "@/components/forms/ClientCombobox";

interface CreateTaskDialogProps {
  defaultDate: Date;
  defaultHour?: number;
  defaultMinute?: number;
  defaultWorkerId?: string;
  defaultDuration?: number;
  onCreated: () => void;
}

export default function CreateTaskDialog({ defaultDate, defaultHour, defaultMinute, defaultWorkerId, defaultDuration, onCreated }: CreateTaskDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [interventionType, setInterventionType] = useState<string>("autre");
  const [assignedTo, setAssignedTo] = useState<string>(defaultWorkerId ?? "");
  const [scheduledDate, setScheduledDate] = useState(format(defaultDate, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(
    defaultHour !== undefined
      ? `${String(defaultHour).padStart(2, "0")}:${String(defaultMinute ?? 0).padStart(2, "0")}`
      : "08:00"
  );
  const [durationMinutes, setDurationMinutes] = useState(defaultDuration ?? 60);
  const [endTime, setEndTime] = useState(
    computeEndTime(
      defaultHour !== undefined
        ? `${String(defaultHour).padStart(2, "0")}:${String(defaultMinute ?? 0).padStart(2, "0")}`
        : "08:00",
      defaultDuration ?? 60
    )
  );
  const [clientId, setClientId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [memoSecretariat, setMemoSecretariat] = useState("");

  const [workers, setWorkers] = useState<{ id: string; full_name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; address_intervention?: string | null }[]>([]);
  const [existingTasks, setExistingTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      const [w, c] = await Promise.all([
        supabase.from("profiles").select("id, full_name").eq("is_active", true),
        supabase.from("clients").select("id, name, address_intervention").order("name"),
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
      const newStart =
        defaultHour !== undefined
          ? `${String(defaultHour).padStart(2, "0")}:${String(defaultMinute ?? 0).padStart(2, "0")}`
          : startTime;
      if (defaultHour !== undefined) setStartTime(newStart);
      if (defaultWorkerId) setAssignedTo(defaultWorkerId);
      if (defaultDuration) {
        setDurationMinutes(defaultDuration);
        setEndTime(computeEndTime(newStart, defaultDuration));
      } else {
        setEndTime(computeEndTime(newStart, durationMinutes));
      }
    }
  }, [open, defaultDate, defaultHour, defaultMinute, defaultWorkerId, defaultDuration]);

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
    } as any);
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
                  {Object.entries(SIMPLIFIED_TYPES).map(([k, v]) => (
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
