import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ClientCombobox from "@/components/forms/ClientCombobox";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Commande existante → mode édition */
  order?: any | null;
}

export default function CreateOrderDialog({ open, onOpenChange, onSaved, order }: Props) {
  const isEdit = !!order;
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [form, setForm] = useState({
    part_name: "",
    part_reference: "",
    quantity: 1,
    supplier: "",
    urgency: "normal" as "normal" | "urgent" | "critique",
    client_id: "",
    work_task_id: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    supabase.from("clients").select("id, name, address_intervention").order("name").then(({ data }) => setClients(data ?? []));
    supabase
      .from("work_tasks")
      .select("id, title, scheduled_date, client_id")
      .order("scheduled_date", { ascending: false })
      .limit(300)
      .then(({ data }) => setTasks(data ?? []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (order) {
      setForm({
        part_name: order.part_name ?? "",
        part_reference: order.part_reference ?? "",
        quantity: order.quantity ?? 1,
        supplier: order.supplier ?? "",
        urgency: (order.urgency ?? "normal") as any,
        client_id: order.client_id ?? "",
        work_task_id: order.work_task_id ?? "",
        notes: order.notes ?? "",
      });
    } else {
      setForm({ part_name: "", part_reference: "", quantity: 1, supplier: "", urgency: "normal", client_id: "", work_task_id: "", notes: "" });
    }
  }, [open, order]);

  const visibleTasks = form.client_id
    ? tasks.filter((t) => t.client_id === form.client_id)
    : tasks;

  const selectClient = (clientId: string) => {
    setForm((f) => {
      const currentTask = tasks.find((t) => t.id === f.work_task_id);
      const keepTask = currentTask && currentTask.client_id === clientId;
      return { ...f, client_id: clientId, work_task_id: keepTask ? f.work_task_id : "" };
    });
  };

  const selectTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    setForm((f) => ({ ...f, work_task_id: taskId, client_id: task?.client_id ?? f.client_id }));
  };

  const handleSubmit = async () => {
    if (!form.part_name.trim()) { toast.error("Le nom de la pièce est obligatoire"); return; }
    if (!form.work_task_id) { toast.error("Sélectionnez la tâche liée"); return; }

    setLoading(true);

    if (isEdit) {
      const { error: updErr } = await supabase.from("parts_orders").update({
        part_name: form.part_name.trim(),
        part_reference: form.part_reference || null,
        quantity: form.quantity,
        supplier: form.supplier || null,
        urgency: form.urgency,
        client_id: form.client_id || null,
        work_task_id: form.work_task_id || null,
        notes: form.notes || null,
      } as any).eq("id", order.id);
      setLoading(false);
      if (updErr) { toast.error("Erreur : " + updErr.message); return; }
      toast.success("Commande modifiée");
      onOpenChange(false);
      onSaved();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Vous devez être connecté"); setLoading(false); return; }

    const { error } = await supabase.from("parts_orders").insert({
      part_name: form.part_name.trim(),
      part_reference: form.part_reference || null,
      quantity: form.quantity,
      supplier: form.supplier || null,
      urgency: form.urgency,
      client_id: form.client_id || null,
      work_task_id: form.work_task_id || null,
      notes: form.notes || null,
      requested_by: user.id,
      status: "demandee",
    } as any);

    setLoading(false);
    if (error) {
      if (error.message.includes("parts_orders_unique_pending_part")) {
        toast.error("Une commande identique est déjà en attente pour cette tâche.");
      } else {
        toast.error("Erreur : " + error.message);
      }
    }
    else {
      toast.success("Commande créée");
      onOpenChange(false);
      setForm({ part_name: "", part_reference: "", quantity: 1, supplier: "", urgency: "normal", client_id: "", work_task_id: "", notes: "" });
      onSaved();
    }
  };

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la commande" : "Nouvelle commande"}</DialogTitle>
          <DialogDescription>{isEdit ? "Modifiez les informations de la demande de pièce" : "Créez une demande de pièce"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nom de la pièce *</Label>
            <Input value={form.part_name} onChange={(e) => set("part_name", e.target.value)} placeholder="Ex: Vanne gaz 3/4" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Référence</Label>
              <Input value={form.part_reference} onChange={(e) => set("part_reference", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Quantité</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => set("quantity", parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fournisseur</Label>
              <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Urgence</Label>
              <Select value={form.urgency} onValueChange={(v) => set("urgency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="critique">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <ClientCombobox clients={clients} value={form.client_id} onChange={selectClient} placeholder="Rechercher un client..." />
            </div>
            <div className="space-y-2">
              <Label>Tâche liée *</Label>
              <Select value={form.work_task_id} onValueChange={selectTask}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {visibleTasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.scheduled_date?.split("-").reverse().join("/")} · {t.title}
                    </SelectItem>
                  ))}
                  {visibleTasks.length === 0 && (
                    <div className="px-2 py-3 text-sm text-muted-foreground">Aucune tâche pour ce client</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Enregistrement..." : isEdit ? "Enregistrer" : "Créer la commande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
