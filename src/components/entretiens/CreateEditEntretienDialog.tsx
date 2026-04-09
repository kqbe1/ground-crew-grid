import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { INTERVENTION_TYPE_LABELS, PERIODICITY_LABELS } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"maintenance_schedules">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: Schedule | null;
  onSaved: () => void;
}

export default function CreateEditEntretienDialog({ open, onOpenChange, schedule, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [form, setForm] = useState({
    client_id: "",
    client_site_id: "",
    equipment_id: "",
    intervention_type: "entretien_gaz",
    periodicity: "annuel",
    next_due_date: "",
    last_done_date: "",
    legal_alert_years: "",
    notes: "",
    status: "actif",
  });

  useEffect(() => {
    if (!open) return;
    supabase.from("clients").select("id, name").order("name").then(({ data }) => setClients(data ?? []));
    if (schedule) {
      setForm({
        client_id: schedule.client_id,
        client_site_id: schedule.client_site_id || "",
        equipment_id: schedule.equipment_id || "",
        intervention_type: schedule.intervention_type,
        periodicity: schedule.periodicity,
        next_due_date: schedule.next_due_date,
        last_done_date: schedule.last_done_date || "",
        legal_alert_years: schedule.legal_alert_years?.toString() || "",
        notes: schedule.notes || "",
        status: schedule.status,
      });
    } else {
      setForm({ client_id: "", client_site_id: "", equipment_id: "", intervention_type: "entretien_gaz", periodicity: "annuel", next_due_date: "", last_done_date: "", legal_alert_years: "", notes: "", status: "actif" });
    }
  }, [open, schedule]);

  useEffect(() => {
    if (!form.client_id) { setSites([]); setEquipment([]); return; }
    supabase.from("client_sites").select("id, name, address").eq("client_id", form.client_id).then(({ data }) => setSites(data ?? []));
  }, [form.client_id]);

  useEffect(() => {
    if (!form.client_site_id) { setEquipment([]); return; }
    supabase.from("client_equipment").select("id, name, brand, model").eq("client_site_id", form.client_site_id).then(({ data }) => setEquipment(data ?? []));
  }, [form.client_site_id]);

  const handleSubmit = async () => {
    if (!form.client_id || !form.next_due_date) { toast.error("Client et prochaine échéance obligatoires"); return; }
    setLoading(true);
    const payload = {
      client_id: form.client_id,
      client_site_id: form.client_site_id || null,
      equipment_id: form.equipment_id || null,
      intervention_type: form.intervention_type as any,
      periodicity: form.periodicity as any,
      next_due_date: form.next_due_date,
      last_done_date: form.last_done_date || null,
      legal_alert_years: form.legal_alert_years ? parseInt(form.legal_alert_years) : null,
      notes: form.notes || null,
      status: form.status,
    };
    const { error } = schedule
      ? await supabase.from("maintenance_schedules").update(payload).eq("id", schedule.id)
      : await supabase.from("maintenance_schedules").insert(payload as any);
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success(schedule ? "Entretien modifié" : "Entretien créé"); onOpenChange(false); onSaved(); }
  };

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const entretienTypes = Object.entries(INTERVENTION_TYPE_LABELS).filter(([k]) => k.startsWith("entretien_"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{schedule ? "Modifier l'entretien" : "Nouvel entretien"}</DialogTitle>
          <DialogDescription>{schedule ? "Modifiez les informations" : "Planifiez un entretien récurrent"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={form.client_id} onValueChange={(v) => set("client_id", v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {sites.length > 0 && (
            <div className="space-y-2">
              <Label>Site</Label>
              <Select value={form.client_site_id} onValueChange={(v) => set("client_site_id", v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un site" /></SelectTrigger>
                <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} — {s.address}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {equipment.length > 0 && (
            <div className="space-y-2">
              <Label>Équipement</Label>
              <Select value={form.equipment_id} onValueChange={(v) => set("equipment_id", v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{equipment.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} {e.brand && `(${e.brand})`}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type d'entretien *</Label>
              <Select value={form.intervention_type} onValueChange={(v) => set("intervention_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{entretienTypes.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Périodicité</Label>
              <Select value={form.periodicity} onValueChange={(v) => set("periodicity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PERIODICITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prochaine échéance *</Label>
              <Input type="date" value={form.next_due_date} onChange={(e) => set("next_due_date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Dernier entretien</Label>
              <Input type="date" value={form.last_done_date} onChange={(e) => set("last_done_date", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Alerte légale (années)</Label>
              <Input type="number" min={1} max={10} value={form.legal_alert_years} onChange={(e) => set("legal_alert_years", e.target.value)} placeholder="Ex: 2" />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="actif">Actif</SelectItem>
                  <SelectItem value="suspendu">Suspendu</SelectItem>
                  <SelectItem value="termine">Terminé</SelectItem>
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
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Enregistrement..." : schedule ? "Modifier" : "Créer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
