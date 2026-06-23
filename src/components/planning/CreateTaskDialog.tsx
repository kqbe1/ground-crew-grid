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

const DRAFT_KEY = "create_task_draft_v1";
function loadDraft(): any | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
}

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
  const _draft = loadDraft();
  // Si le dialog était ouvert via clic créneau, on ne restaure pas son état "open"
  const [open, setOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState<string>(_draft?.title ?? "");
  const [interventionType, setInterventionType] = useState<string>(_draft?.interventionType ?? "autre");
  const [assignedTo, setAssignedTo] = useState<string>(_draft?.assignedTo ?? defaultWorkerId ?? "");
  const [binomeId, setBinomeId] = useState<string>(_draft?.binomeId ?? "");
  const [scheduledDate, setScheduledDate] = useState<string>(_draft?.scheduledDate ?? format(defaultDate, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState<string>(
    _draft?.startTime ?? (defaultHour !== undefined
      ? `${String(defaultHour).padStart(2, "0")}:${String(defaultMinute ?? 0).padStart(2, "0")}`
      : "08:00")
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(_draft?.durationMinutes ?? (defaultDuration ?? 60));
  const [endTime, setEndTime] = useState<string>(
    _draft?.endTime ?? computeEndTime(
      defaultHour !== undefined
        ? `${String(defaultHour).padStart(2, "0")}:${String(defaultMinute ?? 0).padStart(2, "0")}`
        : "08:00",
      defaultDuration ?? 60
    )
  );
  const [clientId, setClientId] = useState<string>(_draft?.clientId ?? "");
  const [description, setDescription] = useState<string>(_draft?.description ?? "");
  const [memoSecretariat, setMemoSecretariat] = useState<string>(_draft?.memoSecretariat ?? "");

  const [workers, setWorkers] = useState<{ id: string; full_name: string }[]>([]);
  const [binomes, setBinomes] = useState<{ id: string; full_name: string; binome_level: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; address_intervention?: string | null }[]>([]);
  const [existingTasks, setExistingTasks] = useState<any[]>([]);

  // Persist draft as user types / opens dialog
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        title, interventionType, assignedTo, binomeId, scheduledDate, startTime, endTime,
        durationMinutes, clientId, description, memoSecretariat,
      }));
    } catch {}
  }, [title, interventionType, assignedTo, binomeId, scheduledDate, startTime, endTime, durationMinutes, clientId, description, memoSecretariat]);

  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      const [w, c] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role").eq("is_active", true).in("role", ["ouvrier", "admin"]),
        supabase.from("clients").select("id, name, address_intervention").order("name"),
      ]);
      setWorkers(w.data ?? []);
      setClients(c.data ?? []);
      const { data: b } = await supabase
        .from("profiles")
        .select("id, full_name, binome_level")
        .eq("is_active", true)
        .not("binome_level", "is", null);
      setBinomes((b ?? []).filter((x: any) => !!x.binome_level));
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

  // Reset defaults when dialog opens. Le contexte (clic sur un créneau) est toujours
  // prioritaire sur le brouillon précédent.
  useEffect(() => {
    if (!open) return;
    // Toujours appliquer la date du contexte si fournie
    setScheduledDate(format(defaultDate, "yyyy-MM-dd"));
    if (defaultHour !== undefined) {
      const newStart = `${String(defaultHour).padStart(2, "0")}:${String(defaultMinute ?? 0).padStart(2, "0")}`;
      setStartTime(newStart);
      const dur = defaultDuration ?? durationMinutes;
      setDurationMinutes(dur);
      setEndTime(computeEndTime(newStart, dur));
    }
    if (defaultWorkerId) setAssignedTo(defaultWorkerId);
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
      second_assigned_to: binomeId || null,
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
    setBinomeId("");
    setOpen(false);
    clearDraft();
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
            <Label>Client</Label>
            <ClientCombobox clients={clients} value={clientId} onChange={setClientId} placeholder="Rechercher un client..." />
          </div>

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

          <div>
            <Label>Binôme</Label>
            <Select value={binomeId || "__none"} onValueChange={(v) => setBinomeId(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Aucun binôme" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Aucun binôme</SelectItem>
                {binomes.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.binome_level} — {b.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
