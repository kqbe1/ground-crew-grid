import { useState, useEffect, useMemo, useRef } from "react";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { findOverlapsForWorkers } from "@/lib/overlapUtils";
import ConflictAlert from "@/components/planning/ConflictAlert";
import { computeEndTime, computeDurationMinutes } from "@/lib/timeRange";
import { WorkerMultiSelectField } from "@/components/forms/WorkerMultiSelect";
import ClientCombobox from "@/components/forms/ClientCombobox";
import { INTERVENTION_TYPE_LABELS } from "@/lib/constants";

const DRAFT_KEY = "create_task_draft_v1";
function loadDraft(): any | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* Ignore storage errors */ }
}

interface CreateTaskDialogProps {
  defaultDate: Date;
  defaultHour?: number;
  defaultMinute?: number;
  defaultWorkerId?: string;
  defaultDuration?: number;
  onCreated: () => void;
  /** Mode contrôlé (ex: bouton "Planifier" depuis un entretien) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  defaultClientId?: string;
  defaultInterventionType?: string;
  defaultTitle?: string;
}

export default function CreateTaskDialog({
  defaultDate, defaultHour, defaultMinute, defaultWorkerId, defaultDuration, onCreated,
  open: openProp, onOpenChange: onOpenChangeProp, hideTrigger, defaultClientId, defaultInterventionType, defaultTitle,
}: CreateTaskDialogProps) {
  const { user } = useAuth();
  const _draft = loadDraft();
  // Si le dialog était ouvert via clic créneau, on ne restaure pas son état "open"
  const [openState, setOpenState] = useState<boolean>(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => { if (onOpenChangeProp) { onOpenChangeProp(v); } else { setOpenState(v); } };
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
  const [extraWorkers, setExtraWorkers] = useState<string[]>([]);
  const [binomes, setBinomes] = useState<{ id: string; name: string; code: string; kind: string }[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string; intervention_type: string; description: string | null; default_duration_minutes: number }[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [clients, setClients] = useState<{ id: string; name: string; address_intervention?: string | null }[]>([]);
  const [existingTasks, setExistingTasks] = useState<any[]>([]);
  const startTimeRef = useRef<HTMLInputElement | null>(null);

  // Persist draft as user types / opens dialog
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        title, interventionType, assignedTo, binomeId, scheduledDate, startTime, endTime,
        durationMinutes, clientId, description, memoSecretariat,
      }));
    } catch { /* Ignore storage errors */ }
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
        .from("task_binomes")
        .select("id, name, code, kind")
        .eq("is_active", true)
        .order("code");
      setBinomes((b ?? []) as any);
      const { data: tpl } = await supabase
        .from("task_templates")
        .select("id, name, intervention_type, description, default_duration_minutes")
        .order("name");
      setTemplates((tpl ?? []) as any);
    };
    fetchData();
  }, [open]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setTitle(tpl.name);
    setInterventionType(tpl.intervention_type);
    if (tpl.description) setDescription(tpl.description);
    const dur = tpl.default_duration_minutes || durationMinutes;
    setDurationMinutes(dur);
    setEndTime(computeEndTime(startTime, dur));
  };

  // Fetch tasks for the selected date to check overlaps
  useEffect(() => {
    if (!open || !scheduledDate) return;
    const fetchTasks = async () => {
      const { data } = await supabase
        .from("work_tasks")
        .select("id, title, assigned_to, second_assigned_to, scheduled_date, start_time, duration_minutes")
        .eq("scheduled_date", scheduledDate);
      setExistingTasks(data ?? []);
    };
    fetchTasks();
  }, [open, scheduledDate]);

  const conflicts = useMemo(() => {
    if (!startTime) return [];
    return findOverlapsForWorkers(
      [assignedTo, ...extraWorkers],
      scheduledDate,
      startTime,
      durationMinutes,
      existingTasks,
    );
  }, [assignedTo, extraWorkers, scheduledDate, startTime, durationMinutes, existingTasks]);

  const workerNames = useMemo(
    () => Object.fromEntries(workers.map((w) => [w.id, w.full_name])),
    [workers],
  );

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
  }, [open, defaultDate, defaultHour, defaultMinute, defaultWorkerId, defaultDuration, durationMinutes]);
  // Valeurs pré-remplies fournies par l'appelant (client / type / titre)
  useEffect(() => {
    if (!open) return;
    if (defaultClientId) setClientId(defaultClientId);
    if (defaultInterventionType) setInterventionType(defaultInterventionType);
    if (defaultTitle) setTitle((t) => t || defaultTitle);
  }, [open, defaultClientId, defaultInterventionType, defaultTitle]);

  const handleSubmit = async () => {
    if (!title.trim() || !user) {
      toast.error("Le titre est obligatoire");
      return;
    }
    if (conflicts.length > 0) {
      toast.error("Conflit horaire : modifiez l'horaire ou l'ouvrier avant de valider");
      startTimeRef.current?.focus();
      return;
    }
    setLoading(true);
    const { data: created, error } = await supabase.from("work_tasks").insert({
      title: title.trim(),
      intervention_type: interventionType as any,
      assigned_to: assignedTo || null,
      second_assigned_to: null,
      binome_id: binomeId || null,
      template_id: templateId || null,
      scheduled_date: scheduledDate,
      start_time: startTime,
      duration_minutes: durationMinutes,
      client_id: clientId || null,
      description: description || null,
      memo_secretariat: memoSecretariat || null,
      created_by: user.id,
      status: "planifie" as any,
    } as any).select("id").single();
    setLoading(false);
    if (error) {
      toast.error("Erreur lors de la création: " + error.message);
      return;
    }
    const allAssignees = Array.from(new Set([assignedTo, ...extraWorkers].filter(Boolean)));
    if (created?.id && allAssignees.length > 0) {
      await supabase.from("work_task_assignees" as any).upsert(
        allAssignees.map((uid) => ({
          work_task_id: created.id,
          user_id: uid,
        })),
        { onConflict: "work_task_id,user_id" }
      );
    }

    if (allAssignees.length > 0) {
      const { error: pushError } = await supabase.functions.invoke("send-push", {
        body: {
        user_ids: allAssignees,
        title: "Nouvelle intervention",
        body: `${title.trim()} — ${scheduledDate} à ${startTime}`,
        data: {
          route: "/mobile",
          task_id: created?.id ?? "",
          type: "task_created",
        },
      },
    });

    if (pushError) {
      console.error("Failed to send push notification:", pushError);
      }
    }

    toast.success("Tâche créée");
    setTitle("");
    setDescription("");
    setMemoSecretariat("");
    setBinomeId("");
    setTemplateId("");
    setExtraWorkers([]);
    setOpen(false);
    clearDraft();
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm" data-create-task-trigger>
            <Plus className="w-4 h-4 mr-1" /> Nouvelle tâche
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une tâche</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Client</Label>
            <ClientCombobox clients={clients} value={clientId} onChange={setClientId} placeholder="Rechercher un client..." />
          </div>

          {templates.length > 0 && (
            <div>
              <Label>Modèle de tâche</Label>
              <Select value={templateId} onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue placeholder="Aucun modèle" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
                  {Object.entries({
                    ...SIMPLIFIED_TYPES,
                    ...(SIMPLIFIED_TYPES[interventionType]
                      ? {}
                      : { [interventionType]: INTERVENTION_TYPE_LABELS[interventionType] || interventionType }),
                  }).map(([k, v]) => (
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

          <WorkerMultiSelectField
            workers={workers}
            value={extraWorkers}
            onChange={setExtraWorkers}
            primaryId={assignedTo || undefined}
          />

          <div>
            <Label>Binôme</Label>
            <Select value={binomeId || "__none"} onValueChange={(v) => setBinomeId(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Aucun binôme" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Aucun binôme</SelectItem>
                {binomes.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.code} — {b.name} ({b.kind})
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
                ref={startTimeRef}
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

          <ConflictAlert
            conflicts={conflicts}
            workerNames={workerNames}
            onFix={() => startTimeRef.current?.focus()}
          />

          <Button onClick={handleSubmit} disabled={loading || conflicts.length > 0} className="w-full">
            {loading ? "Création..." : conflicts.length > 0 ? "Conflit horaire à résoudre" : "Créer la tâche"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
