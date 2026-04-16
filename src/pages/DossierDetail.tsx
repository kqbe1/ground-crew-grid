import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import BackButton from "@/components/ui/back-button";
import { ClipboardList, Wrench, FileText, Package, Phone, Mail, MapPin, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

const statusLabels: Record<string, string> = {
  planifie: "Planifié",
  termine: "Terminé",
  a_replanifier: "À replanifier",
  piece_a_commander: "Pièce à commander",
  sav: "SAV",
  en_attente: "En attente",
  dossier_en_cours: "Dossier en cours",
  en_commande: "En commande",
  cloture: "Clôturé",
  demandee: "Demandée",
  commandee: "Commandée",
  recue: "Reçue",
  cloturee: "Clôturée",
  actif: "Actif",
};

const statusColor = (s: string) => {
  if (["termine", "cloture", "cloturee", "recue"].includes(s)) return "default";
  if (["planifie", "en_attente", "demandee", "actif"].includes(s)) return "secondary";
  if (["sav", "piece_a_commander"].includes(s)) return "destructive";
  return "outline";
};

export default function DossierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [fiches, setFiches] = useState<any[]>([]);
  const [entretiens, setEntretiens] = useState<any[]>([]);
  const [devis, setDevis] = useState<any[]>([]);
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const { data: clientData } = await supabase.from("clients").select("*").eq("id", id).single();
    setClient(clientData);

    if (!clientData) { setLoading(false); return; }

    const [fichesRes, entretiensRes, commandesRes] = await Promise.all([
      supabase
        .from("work_tasks")
        .select("id, title, scheduled_date, status, intervention_type, intervention_sheets(id, final_status, created_at)")
        .eq("client_id", id)
        .not("intervention_sheets", "is", null)
        .order("scheduled_date", { ascending: false }),
      supabase
        .from("maintenance_schedules")
        .select("*")
        .eq("client_id", id)
        .order("next_due_date", { ascending: false }),
      supabase
        .from("parts_orders")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
    ]);

    // Devis matched by name
    const { data: devisData } = await supabase
      .from("quotes")
      .select("*")
      .ilike("client_name", clientData.name)
      .order("created_at", { ascending: false });

    setFiches(fichesRes.data ?? []);
    setEntretiens(entretiensRes.data ?? []);
    setDevis(devisData ?? []);
    setCommandes(commandesRes.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-4 md:p-8 lg:px-12 lg:py-10 space-y-8">
        <BackButton fallback="/dossiers" />
        <p className="text-muted-foreground text-center py-12">Client introuvable</p>
      </div>
    );
  }

  const interventionTypeLabels: Record<string, string> = {
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

  const periodicityLabels: Record<string, string> = {
    mensuel: "Mensuel",
    trimestriel: "Trimestriel",
    semestriel: "Semestriel",
    annuel: "Annuel",
    bisannuel: "Bisannuel",
    triennal: "Triennal",
  };

  return (
    <div className="p-4 md:p-8 lg:px-12 lg:py-10 space-y-8">
      <BackButton fallback="/dossiers" />

      {/* Client header */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex-1 space-y-2">
          <h1 className="text-2xl lg:text-3xl font-bold">{client.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {client.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {client.phone}</span>}
            {client.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {client.email}</span>}
            {client.address_intervention && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {client.address_intervention}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/clients/${client.id}`)}>
            <User className="w-4 h-4 mr-1.5" /> Voir fiche client
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><ClipboardList className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{fiches.length}</p>
              <p className="text-xs text-muted-foreground">Fiche(s)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Wrench className="w-5 h-5 text-blue-500" /></div>
            <div>
              <p className="text-2xl font-bold">{entretiens.length}</p>
              <p className="text-xs text-muted-foreground">Entretien(s)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10"><FileText className="w-5 h-5 text-amber-500" /></div>
            <div>
              <p className="text-2xl font-bold">{devis.length}</p>
              <p className="text-xs text-muted-foreground">Devis</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><Package className="w-5 h-5 text-green-500" /></div>
            <div>
              <p className="text-2xl font-bold">{commandes.length}</p>
              <p className="text-xs text-muted-foreground">Commande(s)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="fiches" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="fiches" className="gap-1 text-xs sm:text-sm"><ClipboardList className="w-3.5 h-3.5 hidden sm:block" /> Fiches</TabsTrigger>
          <TabsTrigger value="entretiens" className="gap-1 text-xs sm:text-sm"><Wrench className="w-3.5 h-3.5 hidden sm:block" /> Entretiens</TabsTrigger>
          <TabsTrigger value="devis" className="gap-1 text-xs sm:text-sm"><FileText className="w-3.5 h-3.5 hidden sm:block" /> Devis</TabsTrigger>
          <TabsTrigger value="commandes" className="gap-1 text-xs sm:text-sm"><Package className="w-3.5 h-3.5 hidden sm:block" /> Commandes</TabsTrigger>
        </TabsList>

        {/* Fiches tab */}
        <TabsContent value="fiches">
          {fiches.length === 0 ? (
            <EmptyState icon={ClipboardList} label="Aucune fiche d'intervention" />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fiches.map((f) => {
                    const sheet = Array.isArray(f.intervention_sheets) ? f.intervention_sheets[0] : f.intervention_sheets;
                    return (
                      <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50" onClick={() => sheet && navigate(`/fiches/${sheet.id}`)}>
                        <TableCell className="font-medium">{f.title}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{interventionTypeLabels[f.intervention_type] ?? f.intervention_type}</TableCell>
                        <TableCell className="text-sm">
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />{format(new Date(f.scheduled_date), "dd MMM yyyy", { locale: fr })}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusColor(sheet?.final_status ?? f.status) as any}>{statusLabels[sheet?.final_status ?? f.status] ?? f.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Entretiens tab */}
        <TabsContent value="entretiens">
          {entretiens.length === 0 ? (
            <EmptyState icon={Wrench} label="Aucun entretien planifié" />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Périodicité</TableHead>
                    <TableHead>Prochaine échéance</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entretiens.map((e) => (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/entretiens/${e.id}`)}>
                      <TableCell className="font-medium">{interventionTypeLabels[e.intervention_type] ?? e.intervention_type}</TableCell>
                      <TableCell className="text-muted-foreground">{periodicityLabels[e.periodicity] ?? e.periodicity}</TableCell>
                      <TableCell className="text-sm">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />{format(new Date(e.next_due_date), "dd MMM yyyy", { locale: fr })}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor(e.status) as any}>{statusLabels[e.status] ?? e.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Devis tab */}
        <TabsContent value="devis">
          {devis.length === 0 ? (
            <EmptyState icon={FileText} label="Aucun devis" />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Type installation</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devis.map((d) => (
                    <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/devis/${d.id}`)}>
                      <TableCell className="font-medium">{d.client_name}</TableCell>
                      <TableCell className="text-muted-foreground capitalize">{d.installation_type?.replace(/_/g, " ") ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />{format(new Date(d.created_at), "dd MMM yyyy", { locale: fr })}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor(d.status) as any}>{statusLabels[d.status] ?? d.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Commandes tab */}
        <TabsContent value="commandes">
          {commandes.length === 0 ? (
            <EmptyState icon={Package} label="Aucune commande de pièces" />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pièce</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Qté</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commandes.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/commandes/${c.id}`)}>
                      <TableCell className="font-medium">{c.part_name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.part_reference ?? "—"}</TableCell>
                      <TableCell>{c.quantity}</TableCell>
                      <TableCell className="text-sm">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />{format(new Date(c.created_at), "dd MMM yyyy", { locale: fr })}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor(c.status) as any}>{statusLabels[c.status] ?? c.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="py-12 text-center text-muted-foreground">
      <Icon className="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p>{label}</p>
    </div>
  );
}
