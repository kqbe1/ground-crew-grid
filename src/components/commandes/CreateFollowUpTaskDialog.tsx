import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INTERVENTION_TYPE_LABELS } from "@/lib/constants";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  onCreated: () => void;
}

export default function CreateFollowUpTaskDialog({ open, onOpenChange, order, onCreated }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [interventionType, setInterventionType] = useState("autre");
  const [assignedTo, setAssignedTo] = useState("");
  const [scheduledDate, setScheduledDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("08:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [description, setDescription] = useState("");

  const [workers, setWorkers] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    if (!open || !order) return;
    setTitle(`Suite : ${order.part_name}`);
    setDescription(`Pièce reçue (${order.part_name}${order.part_reference ? ` — réf. ${order.part_reference}` : ""}, qté ${order.quantity}). Poursuivre le travail.`);
    setScheduledDate(format(new Date(), "yyyy-MM-dd"));

    supabase.from("profiles").select("id, full_name").eq("is_active", true).then(({ data }) => {
      setWorkers(data ?? []);
    });
  }, [open, order]);

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
      client_id: order.client_id || null,
      description: description || null,
      created_by: user.id,
      status: "planifie" as any,
    });
    setLoading(false);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Tâche de suite créée et planifiée !");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-primary" /> Planifier la suite du travail
          </DialogTitle>
          <DialogDescription>
            La pièce « {order?.part_name} » est reçue. Créez une tâche pour poursuivre l'intervention.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
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

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Plus tard
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
              {loading ? "Création…" : "Créer la tâche"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
