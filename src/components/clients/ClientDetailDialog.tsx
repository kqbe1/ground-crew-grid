import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, Mail, MapPin, Calendar, Building2, Wrench, FileText, Plus, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Client = Tables<"clients">;
type ClientSite = Tables<"client_sites">;
type ClientEquipment = Tables<"client_equipment">;

const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  entretien_gaz: "Entretien Gaz",
  entretien_mazout: "Entretien Mazout",
  entretien_pellets: "Entretien Pellets",
  entretien_clim: "Entretien Clim",
  entretien_vmc: "Entretien VMC",
  depannage: "Dépannage",
  installation: "Installation",
  remplacement: "Remplacement",
  rdv_divers: "RDV Divers",
  autre: "Autre",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planifie: { label: "Planifié", color: "bg-blue-100 text-blue-800" },
  termine: { label: "Terminé", color: "bg-green-100 text-green-800" },
  a_replanifier: { label: "À replanifier", color: "bg-orange-100 text-orange-800" },
  piece_a_commander: { label: "Pièce à commander", color: "bg-red-100 text-red-800" },
};

const ENERGY_LABELS: Record<string, string> = {
  gaz: "Gaz", mazout: "Mazout", pellets: "Pellets", electricite: "Électricité",
  clim: "Clim", vmc: "VMC", autre: "Autre",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onEdit: () => void;
  onDeleted?: () => void;
}

export default function ClientDetailDialog({ open, onOpenChange, client, onEdit, onDeleted }: Props) {
  const [sites, setSites] = useState<ClientSite[]>([]);
  const [equipment, setEquipment] = useState<ClientEquipment[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newSite, setNewSite] = useState({ name: "", address: "" });
  const [showAddSite, setShowAddSite] = useState(false);
  const [newEquip, setNewEquip] = useState({ name: "", brand: "", model: "", energy_type: "autre" as string, client_site_id: "" });
  const [showAddEquip, setShowAddEquip] = useState(false);

  useEffect(() => {
    if (!client || !open) return;
    fetchSites();
    fetchTasks();
  }, [client, open]);

  useEffect(() => {
    if (sites.length > 0) fetchEquipment();
  }, [sites]);

  const fetchSites = async () => {
    if (!client) return;
    const { data } = await supabase.from("client_sites").select("*").eq("client_id", client.id).order("is_primary", { ascending: false });
    setSites(data ?? []);
  };

  const fetchEquipment = async () => {
    if (sites.length === 0) { setEquipment([]); return; }
    const siteIds = sites.map((s) => s.id);
    const { data } = await supabase.from("client_equipment").select("*").in("client_site_id", siteIds);
    setEquipment(data ?? []);
  };

  const fetchTasks = async () => {
    if (!client) return;
    const { data } = await supabase.from("work_tasks").select("*").eq("client_id", client.id).order("scheduled_date", { ascending: false }).limit(50);
    setTasks(data ?? []);
  };

  const addSite = async () => {
    if (!client || !newSite.name.trim() || !newSite.address.trim()) return;
    const { error } = await supabase.from("client_sites").insert({
      client_id: client.id, name: newSite.name, address: newSite.address, is_primary: sites.length === 0,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Site ajouté"); setNewSite({ name: "", address: "" }); setShowAddSite(false); fetchSites(); }
  };

  const deleteSite = async (id: string) => {
    const { error } = await supabase.from("client_sites").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Site supprimé"); fetchSites(); }
  };

  const addEquipment = async () => {
    if (!newEquip.name.trim() || !newEquip.client_site_id) return;
    const { error } = await supabase.from("client_equipment").insert({
      name: newEquip.name as any,
      brand: newEquip.brand || null,
      model: newEquip.model || null,
      energy_type: newEquip.energy_type as any,
      client_site_id: newEquip.client_site_id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Équipement ajouté"); setNewEquip({ name: "", brand: "", model: "", energy_type: "autre", client_site_id: "" }); setShowAddEquip(false); fetchEquipment(); }
  };

  const deleteEquipment = async (id: string) => {
    const { error } = await supabase.from("client_equipment").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Équipement supprimé"); fetchEquipment(); }
  };

  if (!client) return null;

  const deleteClient = async () => {
    if (!client) return;
    const { error } = await supabase.from("clients").delete().eq("id", client.id);
    if (error) { toast.error("Erreur : " + error.message); return; }
    toast.success("Client supprimé");
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{client.name}</DialogTitle>
              <DialogDescription>Fiche client détaillée</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-1" /> Modifier
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-1" /> Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" /> Supprimer le client
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Êtes-vous sûr de vouloir supprimer <strong>{client.name}</strong> ? Cette action est irréversible. Les sites et équipements liés seront également supprimés.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteClient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="infos" className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="infos">Infos</TabsTrigger>
            <TabsTrigger value="sites">Sites ({sites.length})</TabsTrigger>
            <TabsTrigger value="equipments">Équipements ({equipment.length})</TabsTrigger>
            <TabsTrigger value="history">Historique ({tasks.length})</TabsTrigger>
          </TabsList>

          {/* ---- INFOS TAB ---- */}
          <TabsContent value="infos">
            <div className="grid gap-3 text-sm">
              {client.phone && (
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> {client.phone}
                  {client.phone_secondary && <span className="text-muted-foreground">/ {client.phone_secondary}</span>}
                </div>
              )}
              {client.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> {client.email}</div>}
              {client.address_intervention && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /> {client.address_intervention}</div>}
              {client.address_billing && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground opacity-50" /> Facturation : {client.address_billing}</div>}
              {client.birthday && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /> Anniversaire : {format(new Date(client.birthday), "dd MMMM yyyy", { locale: fr })}</div>}
              {client.contact_syndic && <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" /> Syndic : {client.contact_syndic}</div>}
              {client.contact_locataire && <div><span className="text-muted-foreground">Locataire :</span> {client.contact_locataire}</div>}
              {client.syndic_keys_codes && <div><span className="text-muted-foreground">Clés/Codes :</span> {client.syndic_keys_codes}</div>}
              {client.notes_internal && (
                <Card className="mt-2">
                  <CardContent className="p-3 text-sm">
                    <p className="font-medium mb-1">Notes internes</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{client.notes_internal}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ---- SITES TAB ---- */}
          <TabsContent value="sites">
            <div className="space-y-3">
              {sites.map((site) => (
                <Card key={site.id}>
                  <CardContent className="p-3 flex items-start justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {site.name}
                        {site.is_primary && <Badge variant="secondary" className="text-xs">Principal</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{site.address}</p>
                      {site.notes && <p className="text-xs text-muted-foreground mt-1">{site.notes}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteSite(site.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {!showAddSite ? (
                <Button variant="outline" size="sm" onClick={() => setShowAddSite(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Ajouter un site
                </Button>
              ) : (
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <Input placeholder="Nom du site" value={newSite.name} onChange={(e) => setNewSite((s) => ({ ...s, name: e.target.value }))} />
                    <Input placeholder="Adresse" value={newSite.address} onChange={(e) => setNewSite((s) => ({ ...s, address: e.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addSite}>Ajouter</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAddSite(false)}>Annuler</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ---- EQUIPMENTS TAB ---- */}
          <TabsContent value="equipments">
            <div className="space-y-3">
              {equipment.map((eq) => {
                const site = sites.find((s) => s.id === eq.client_site_id);
                return (
                  <Card key={eq.id}>
                    <CardContent className="p-3 flex items-start justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <Wrench className="w-4 h-4" /> {eq.name}
                          <Badge variant="outline" className="text-xs">{ENERGY_LABELS[eq.energy_type] || eq.energy_type}</Badge>
                        </div>
                        {(eq.brand || eq.model) && <p className="text-sm text-muted-foreground">{[eq.brand, eq.model].filter(Boolean).join(" - ")}</p>}
                        {site && <p className="text-xs text-muted-foreground">Site : {site.name}</p>}
                        {eq.next_maintenance_date && <p className="text-xs text-muted-foreground">Prochain entretien : {format(new Date(eq.next_maintenance_date), "dd/MM/yyyy")}</p>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteEquipment(eq.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              {sites.length === 0 && <p className="text-sm text-muted-foreground">Ajoutez d'abord un site pour ajouter des équipements.</p>}
              {sites.length > 0 && !showAddEquip && (
                <Button variant="outline" size="sm" onClick={() => setShowAddEquip(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Ajouter un équipement
                </Button>
              )}
              {showAddEquip && (
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <Input placeholder="Nom de l'équipement" value={newEquip.name} onChange={(e) => setNewEquip((s) => ({ ...s, name: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Marque" value={newEquip.brand} onChange={(e) => setNewEquip((s) => ({ ...s, brand: e.target.value }))} />
                      <Input placeholder="Modèle" value={newEquip.model} onChange={(e) => setNewEquip((s) => ({ ...s, model: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={newEquip.energy_type} onValueChange={(v) => setNewEquip((s) => ({ ...s, energy_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ENERGY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={newEquip.client_site_id} onValueChange={(v) => setNewEquip((s) => ({ ...s, client_site_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Site" /></SelectTrigger>
                        <SelectContent>
                          {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addEquipment}>Ajouter</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAddEquip(false)}>Annuler</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ---- HISTORY TAB ---- */}
          <TabsContent value="history">
            <div className="space-y-2">
              {tasks.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Aucune intervention pour ce client</p>}
              {tasks.map((task) => {
                const st = STATUS_LABELS[task.status] || { label: task.status, color: "" };
                return (
                  <Card key={task.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(task.scheduled_date), "dd/MM/yyyy")} à {task.start_time?.slice(0, 5)} — {INTERVENTION_TYPE_LABELS[task.intervention_type] || task.intervention_type}
                          </p>
                        </div>
                        <Badge className={st.color}>{st.label}</Badge>
                      </div>
                      {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
