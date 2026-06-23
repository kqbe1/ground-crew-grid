import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { Plus, Trash2 } from "lucide-react";

type Client = Tables<"clients">;

const ENERGY_LABELS: Record<string, string> = {
  gaz: "Gaz", mazout: "Mazout", pellets: "Pellets", electricite: "Électricité",
  clim: "Clim", vmc: "VMC", autre: "Autre",
};

type DraftEquipment = {
  name: string;
  brand: string;
  model: string;
  energy_type: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSaved: () => void;
}

export default function CreateEditClientDialog({ open, onOpenChange, client, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    phone_secondary: "",
    email: "",
    address_intervention: "",
    address_billing: "",
    contact_syndic: "",
    contact_locataire: "",
    notes_internal: "",
    syndic_keys_codes: "",
    birthday: "",
    region: "",
  });
  const [draftEquipments, setDraftEquipments] = useState<DraftEquipment[]>([]);
  const [newEq, setNewEq] = useState<DraftEquipment>({ name: "", brand: "", model: "", energy_type: "autre" });

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name || "",
        phone: client.phone || "",
        phone_secondary: client.phone_secondary || "",
        email: client.email || "",
        address_intervention: client.address_intervention || "",
        address_billing: client.address_billing || "",
        contact_syndic: client.contact_syndic || "",
        contact_locataire: client.contact_locataire || "",
        notes_internal: client.notes_internal || "",
        syndic_keys_codes: client.syndic_keys_codes || "",
        birthday: client.birthday || "",
        region: (client as any).region || "",
      });
    } else {
      setForm({
        name: "", phone: "", phone_secondary: "", email: "",
        address_intervention: "", address_billing: "", contact_syndic: "",
        contact_locataire: "", notes_internal: "", syndic_keys_codes: "", birthday: "",
        region: "",
      });
    }
  }, [client, open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    setLoading(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone || null,
      phone_secondary: form.phone_secondary || null,
      email: form.email || null,
      address_intervention: form.address_intervention || null,
      address_billing: form.address_billing || null,
      contact_syndic: form.contact_syndic || null,
      contact_locataire: form.contact_locataire || null,
      notes_internal: form.notes_internal || null,
      syndic_keys_codes: form.syndic_keys_codes || null,
      birthday: form.birthday || null,
      region: (form.region || null) as any,
    };

    let savedClientId = client?.id ?? null;
    if (client) {
      const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
      if (error) { setLoading(false); toast.error("Erreur : " + error.message); return; }
    } else {
      const { data, error } = await supabase.from("clients").insert(payload as any).select("id").single();
      if (error || !data) { setLoading(false); toast.error("Erreur : " + (error?.message || "création client")); return; }
      savedClientId = data.id;
    }

    // Auto-create primary site from address_intervention if not already present
    let primarySiteId: string | null = null;
    if (savedClientId && form.address_intervention.trim()) {
      const addr = form.address_intervention.trim();
      const { data: existing } = await supabase
        .from("client_sites").select("id")
        .eq("client_id", savedClientId).eq("address", addr).maybeSingle();
      if (existing?.id) {
        primarySiteId = existing.id;
      } else {
        const { count } = await supabase.from("client_sites")
          .select("id", { count: "exact" }).eq("client_id", savedClientId);
        const { data: site } = await supabase.from("client_sites").insert({
          client_id: savedClientId, name: "Adresse principale",
          address: addr, is_primary: (count ?? 0) === 0,
        } as any).select("id").single();
        primarySiteId = site?.id ?? null;
      }
    }

    // Insert draft equipments (only used in creation flow)
    if (savedClientId && draftEquipments.length > 0 && primarySiteId) {
      const rows = draftEquipments.filter((e) => e.name.trim()).map((e) => ({
        client_site_id: primarySiteId, name: e.name.trim(),
        brand: e.brand || null, model: e.model || null,
        energy_type: e.energy_type as any,
      }));
      if (rows.length > 0) {
        const { error: eqErr } = await supabase.from("client_equipment").insert(rows as any);
        if (eqErr) toast.error("Équipements : " + eqErr.message);
      }
    }

    setLoading(false);
    toast.success(client ? "Client modifié" : "Client créé");
    onOpenChange(false);
    onSaved();
  };

  const addDraftEquipment = () => {
    if (!newEq.name.trim()) return;
    setDraftEquipments((prev) => [...prev, newEq]);
    setNewEq({ name: "", brand: "", model: "", energy_type: "autre" });
  };
  const removeDraftEquipment = (idx: number) => {
    setDraftEquipments((prev) => prev.filter((_, i) => i !== idx));
  };

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? "Modifier le client" : "Nouveau client"}</DialogTitle>
          <DialogDescription>
            {client ? "Modifiez les informations du client" : "Remplissez les informations du nouveau client"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Nom *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nom du client" />
          </div>
          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+32 ..." />
          </div>
          <div className="space-y-2">
            <Label>Téléphone secondaire</Label>
            <Input value={form.phone_secondary} onChange={(e) => set("phone_secondary", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Date de naissance</Label>
            <Input type="date" value={form.birthday} onChange={(e) => set("birthday", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Région</Label>
            <Select value={form.region} onValueChange={(v) => set("region", v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner la région" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bruxelles">Bruxelles</SelectItem>
                <SelectItem value="wallonie">Wallonie</SelectItem>
                <SelectItem value="flandre">Flandre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Adresse d'intervention</Label>
            <Input value={form.address_intervention} onChange={(e) => set("address_intervention", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Coordonnées de facturation</Label>
            <Input value={form.address_billing} onChange={(e) => set("address_billing", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Propriétaire / Syndic</Label>
            <Input value={form.contact_syndic} onChange={(e) => set("contact_syndic", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Contact locataire</Label>
            <Input value={form.contact_locataire} onChange={(e) => set("contact_locataire", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Codes / clés syndic</Label>
            <Input value={form.syndic_keys_codes} onChange={(e) => set("syndic_keys_codes", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes internes</Label>
            <Textarea value={form.notes_internal} onChange={(e) => set("notes_internal", e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Enregistrement..." : client ? "Modifier" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
