import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, Mail, MapPin, Calendar, Building2, Wrench, Plus, Trash2, Pencil, AlertTriangle, Loader2 } from "lucide-react";
import LayoutDetail from "@/components/layout/LayoutDetail";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CreateEditClientDialog from "@/components/clients/CreateEditClientDialog";
import { Separator } from "@/components/ui/separator";

type Client = Tables<"clients">;
type ClientSite = Tables<"client_sites">;
type ClientEquipment = Tables<"client_equipment">;

const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  entretien_gaz: "Entretien Gaz", entretien_mazout: "Entretien Mazout", entretien_pellets: "Entretien Pellets",
  entretien_clim: "Entretien Clim", entretien_vmc: "Entretien VMC", depannage: "Dépannage",
  installation: "Installation", remplacement: "Remplacement", rdv_divers: "RDV Divers", autre: "Autre",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planifie: { label: "Planifié", color: "bg-blue-100 text-blue-800" },
  termine: { label: "Terminé", color: "bg-green-100 text-green-800" },
  a_replanifier: { label: "À replanifier", color: "bg-orange-100 text-orange-800" },
  piece_a_commander: { label: "Pièce à commander", color: "bg-red-100 text-red-800" },
  sav: { label: "SAV", color: "bg-orange-200 text-orange-900" },
};

const ENERGY_LABELS: Record<string, string> = {
  gaz: "Gaz", mazout: "Mazout", pellets: "Pellets", electricite: "Électricité",
  clim: "Clim", vmc: "VMC", autre: "Autre",
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<ClientSite[]>([]);
  const [equipment, setEquipment] = useState<ClientEquipment[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newSite, setNewSite] = useState({ name: "", address: "" });
  const [showAddSite, setShowAddSite] = useState(false);
  const [newEquip, setNewEquip] = useState({ name: "", brand: "", model: "", energy_type: "autre", client_site_id: "" });
  const [showAddEquip, setShowAddEquip] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const fetchClient = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("clients").select("*").eq("id", id).single();
    setClient(data);
    setLoading(false);
  }, [id]);

  const fetchSites = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("client_sites").select("*").eq("client_id", id).order("is_primary", { ascending: false });
    setSites(data ?? []);
  }, [id]);

  const fetchEquipment = useCallback(async () => {
    if (sites.length === 0) { setEquipment([]); return; }
    const { data } = await supabase.from("client_equipment").select("*").in("client_site_id", sites.map((s) => s.id));
    setEquipment(data ?? []);
  }, [sites]);

  const fetchTasks = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("work_tasks").select("*").eq("client_id", id).order("scheduled_date", { ascending: false }).limit(50);
    setTasks(data ?? []);
  }, [id]);

  useEffect(() => { fetchClient(); fetchSites(); fetchTasks(); }, [fetchClient, fetchSites, fetchTasks]);
  useEffect(() => { if (sites.length > 0) fetchEquipment(); }, [sites, fetchEquipment]);

  const addSite = async () => {
    if (!client || !newSite.name.trim() || !newSite.address.trim()) return;
    const { error } = await supabase.from("client_sites").insert({ client_id: client.id, name: newSite.name, address: newSite.address, is_primary: sites.length === 0 } as any);
    if (error) toast.error(error.message);
    else { toast.success("Site ajouté"); setNewSite({ name: "", address: "" }); setShowAddSite(false); fetchSites(); }
  };

  const deleteSite = async (siteId: string) => {
    const { error } = await supabase.from("client_sites").delete().eq("id", siteId);
    if (error) toast.error(error.message);
    else { toast.success("Site supprimé"); fetchSites(); }
  };

  const addEquipment = async () => {
    if (!newEquip.name.trim() || !newEquip.client_site_id) return;
    const { error } = await supabase.from("client_equipment").insert({
      name: newEquip.name, brand: newEquip.brand || null, model: newEquip.model || null,
      energy_type: newEquip.energy_type as any, client_site_id: newEquip.client_site_id,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Équipement ajouté"); setNewEquip({ name: "", brand: "", model: "", energy_type: "autre", client_site_id: "" }); setShowAddEquip(false); fetchEquipment(); }
  };

  const deleteEquipment = async (eqId: string) => {
    const { error } = await supabase.from("client_equipment").delete().eq("id", eqId);
    if (error) toast.error(error.message);
    else { toast.success("Équipement supprimé"); fetchEquipment(); }
  };

  const deleteClient = async () => {
    if (!client) return;
    const { error } = await supabase.from("clients").delete().eq("id", client.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Client supprimé");
    navigate(-1);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!client) return <div className="p-6 text-center text-muted-foreground">Client introuvable</div>;

  return (
    <LayoutDetail
      title={client.name}
      subtitle={client.address_intervention || client.region || ""}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4 mr-1" /> Modifier
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/planning`)}>
            <Plus className="w-4 h-4 mr-1" /> Intervention
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/entretiens`)}>
            <Wrench className="w-4 h-4 mr-1" /> Entretien
          </Button>
        </>
      }
    >
      {/* Infos */}
      <section className="space-y-2">
        <h2 className="font-semibold text-sm">Informations</h2>
        <div className="grid gap-3 text-sm">
          {client.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> {client.phone} {client.phone_secondary && <span className="text-muted-foreground">/ {client.phone_secondary}</span>}</div>}
          {client.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> {client.email}</div>}
          {client.address_intervention && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /> {client.address_intervention}</div>}
          {client.address_billing && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground opacity-50" /> Facturation : {client.address_billing}</div>}
          {client.birthday && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /> Anniversaire : {format(new Date(client.birthday), "dd MMMM yyyy", { locale: fr })}</div>}
          {client.contact_syndic && <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" /> Syndic : {client.contact_syndic}</div>}
          {client.contact_locataire && <div><span className="text-muted-foreground">Locataire :</span> {client.contact_locataire}</div>}
          {client.syndic_keys_codes && <div><span className="text-muted-foreground">Clés/Codes :</span> {client.syndic_keys_codes}</div>}
          {client.notes_internal && (
            <Card><CardContent className="p-3 text-sm">
              <p className="font-medium mb-1">Notes internes</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{client.notes_internal}</p>
            </CardContent></Card>
          )}
        </div>
      </section>

      <Separator />

      {/* Sites */}
      <section className="space-y-3">
        <h2 className="font-semibold text-sm">Sites ({sites.length})</h2>
        {sites.map((site) => (
          <Card key={site.id}>
            <CardContent className="p-3 flex items-start justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">{site.name} {site.is_primary && <Badge variant="secondary" className="text-xs">Principal</Badge>}</div>
                <p className="text-sm text-muted-foreground">{site.address}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteSite(site.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
        {!showAddSite ? (
          <Button variant="outline" size="sm" onClick={() => setShowAddSite(true)}><Plus className="w-4 h-4 mr-1" /> Ajouter un site</Button>
        ) : (
          <Card><CardContent className="p-3 space-y-2">
            <Input placeholder="Nom du site" value={newSite.name} onChange={(e) => setNewSite((s) => ({ ...s, name: e.target.value }))} />
            <Input placeholder="Adresse" value={newSite.address} onChange={(e) => setNewSite((s) => ({ ...s, address: e.target.value }))} />
            <div className="flex gap-2">
              <Button size="sm" onClick={addSite}>Ajouter</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddSite(false)}>Annuler</Button>
            </div>
          </CardContent></Card>
        )}
      </section>

      <Separator />

      {/* Equipment */}
      <section className="space-y-3">
        <h2 className="font-semibold text-sm">Équipements ({equipment.length})</h2>
        {equipment.map((eq) => {
          const site = sites.find((s) => s.id === eq.client_site_id);
          return (
            <Card key={eq.id}>
              <CardContent className="p-3 flex items-start justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2"><Wrench className="w-4 h-4" /> {eq.name} <Badge variant="outline" className="text-xs">{ENERGY_LABELS[eq.energy_type] || eq.energy_type}</Badge></div>
                  {(eq.brand || eq.model) && <p className="text-sm text-muted-foreground">{[eq.brand, eq.model].filter(Boolean).join(" - ")}</p>}
                  {site && <p className="text-xs text-muted-foreground">Site : {site.name}</p>}
                  {eq.next_maintenance_date && <p className="text-xs text-muted-foreground">Prochain entretien : {format(new Date(eq.next_maintenance_date), "dd/MM/yyyy")}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteEquipment(eq.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </CardContent>
            </Card>
          );
        })}
        {sites.length === 0 && <p className="text-sm text-muted-foreground">Ajoutez d'abord un site.</p>}
        {sites.length > 0 && !showAddEquip && (
          <Button variant="outline" size="sm" onClick={() => setShowAddEquip(true)}><Plus className="w-4 h-4 mr-1" /> Ajouter un équipement</Button>
        )}
        {showAddEquip && (
          <Card><CardContent className="p-3 space-y-2">
            <Input placeholder="Nom" value={newEquip.name} onChange={(e) => setNewEquip((s) => ({ ...s, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Marque" value={newEquip.brand} onChange={(e) => setNewEquip((s) => ({ ...s, brand: e.target.value }))} />
              <Input placeholder="Modèle" value={newEquip.model} onChange={(e) => setNewEquip((s) => ({ ...s, model: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={newEquip.energy_type} onValueChange={(v) => setNewEquip((s) => ({ ...s, energy_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ENERGY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
              <Select value={newEquip.client_site_id} onValueChange={(v) => setNewEquip((s) => ({ ...s, client_site_id: v }))}><SelectTrigger><SelectValue placeholder="Site" /></SelectTrigger><SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addEquipment}>Ajouter</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddEquip(false)}>Annuler</Button>
            </div>
          </CardContent></Card>
        )}
      </section>

      <Separator />

      {/* History */}
      <section className="space-y-3">
        <h2 className="font-semibold text-sm">Historique ({tasks.length})</h2>
        {tasks.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Aucune intervention</p>}
        {tasks.map((task) => {
          const st = STATUS_LABELS[task.status] || { label: task.status, color: "" };
          return (
            <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/taches`)}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(task.scheduled_date), "dd/MM/yyyy")} à {task.start_time?.slice(0, 5)} — {INTERVENTION_TYPE_LABELS[task.intervention_type] || task.intervention_type}</p>
                  </div>
                  <Badge className={st.color}>{st.label}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Delete */}
      <div className="border-t pt-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4 mr-1" /> Supprimer ce client</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Supprimer le client</AlertDialogTitle>
              <AlertDialogDescription>Supprimer <strong>{client.name}</strong> ? Sites et équipements seront aussi supprimés.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={deleteClient} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <CreateEditClientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        onSaved={() => { fetchClient(); setEditOpen(false); }}
      />
    </LayoutDetail>
  );
}
