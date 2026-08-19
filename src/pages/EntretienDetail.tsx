import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { INTERVENTION_TYPE_LABELS, PERIODICITY_LABELS, ENERGY_TYPE_LABELS } from "@/lib/constants";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Wrench, MapPin, Calendar, AlertTriangle, Pencil, User, CalendarPlus, Trash2 } from "lucide-react";
import LayoutDetail from "@/components/layout/LayoutDetail";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import CreateEditEntretienDialog from "@/components/entretiens/CreateEditEntretienDialog";
import CreateTaskDialog from "@/components/planning/CreateTaskDialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right break-words">{value}</span>
    </div>
  );
}

export default function EntretienDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canManage = role === "admin" || role === "bureau" || role === "super_admin";
  const [schedule, setSchedule] = useState<any>(null);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const { error, count } = await supabase
        .from("maintenance_schedules")
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) {
        toast.error(`Suppression impossible : ${error.message}`);
        return;
      }
      if (!count) {
        toast.error("Suppression refusée : vous n'avez pas les droits sur cet entretien.");
        return;
      }
      toast.success("Entretien supprimé");
      setDeleteOpen(false);
      navigate("/entretiens", { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const fetchSchedule = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("maintenance_schedules")
      .select(
        "*, clients(id, name, email, phone, phone_secondary, address_intervention, address_billing, postal_code, city, contact_syndic, contact_locataire, syndic_keys_codes, notes_internal, owner:owner_client_id(id, name, phone, phone_secondary, email, address_intervention, postal_code, city)), client_sites(name, address, postal_code, city, notes), client_equipment(name, brand, model, energy_type, maintenance_periodicity, last_maintenance_date, next_maintenance_date, notes), task_binomes:binome_id(code, name)"
      )
      .eq("id", id)
      .maybeSingle();
    setSchedule(data);
    const { data: rows } = await supabase
      .from("maintenance_schedule_assignees" as any)
      .select("user_id, profiles:user_id(full_name, worker_level)")
      .eq("maintenance_schedule_id", id);
    setAssignees(
      ((rows as any[]) || []).map((r) =>
        [r.profiles?.worker_level, r.profiles?.full_name].filter(Boolean).join(" — ")
      ).filter(Boolean)
    );
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  if (loading) return <LayoutDetail loading resourceLabel="Entretien">{null}</LayoutDetail>;
  if (!schedule) return <LayoutDetail notFound resourceLabel="Entretien">{null}</LayoutDetail>;

  const daysUntilDue = schedule.next_due_date ? differenceInDays(new Date(schedule.next_due_date), new Date()) : null;
  const client = schedule.clients || {};
  const site = schedule.client_sites || null;
  const equip = schedule.client_equipment || null;
  const urgencyLevel = daysUntilDue === null ? "none" : daysUntilDue < 0 ? "overdue" : daysUntilDue <= 30 ? "soon" : "ok";
  const urgencyStyles: Record<string, string> = {
    overdue: "bg-destructive/10 text-destructive border-destructive/30",
    soon: "alert-warning",
    ok: "alert-success",
    none: "bg-muted text-muted-foreground",
  };

  return (
    <LayoutDetail
      icon={<Wrench className="w-5 h-5" />}
      title={INTERVENTION_TYPE_LABELS[schedule.intervention_type] || schedule.intervention_type}
      subtitle={schedule.clients?.name}
      hideSeparator
      actions={
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setPlanOpen(true)}>
            <CalendarPlus className="w-4 h-4 mr-1" /> Planifier cet entretien
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4 mr-1" /> Modifier
          </Button>
          {canManage && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="w-4 h-4 mr-1" /> Supprimer
            </Button>
          )}
        </div>
      }
    >
      {/* Due date card */}
      <Card className={cn("border", urgencyStyles[urgencyLevel])}>
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">Prochaine échéance</span>
          </div>
          <div className="text-right">
            <div className="font-bold">
              {schedule.next_due_date ? format(new Date(schedule.next_due_date), "dd MMMM yyyy", { locale: fr }) : "—"}
            </div>
            {daysUntilDue !== null && (
              <div className="text-xs">
                {daysUntilDue < 0 ? `En retard de ${Math.abs(daysUntilDue)} jour(s)` : daysUntilDue === 0 ? "Aujourd'hui" : `Dans ${daysUntilDue} jour(s)`}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {schedule.legal_alert_years && (
        <div className="flex items-center gap-2 text-sm p-2 rounded-md alert-warning border">
          <AlertTriangle className="w-4 h-4" />
          Alerte légale Belgique : tous les {schedule.legal_alert_years} an(s)
        </div>
      )}

      <Separator />

      {/* Client */}
      <Card>
        <CardContent className="p-3 grid gap-2 text-sm">
          <p className="font-medium flex items-center gap-1 mb-1"><User className="w-4 h-4" /> Client</p>
          <Row label="Nom" value={client.name} />
          <Row label="Téléphone" value={client.phone ? <a className="underline" href={`tel:${client.phone}`}>{client.phone}</a> : null} />
          <Row label="Téléphone 2" value={client.phone_secondary ? <a className="underline" href={`tel:${client.phone_secondary}`}>{client.phone_secondary}</a> : null} />
          <Row label="Email" value={client.email ? <a className="underline" href={`mailto:${client.email}`}>{client.email}</a> : null} />
          <Row label="Adresse d'intervention" value={client.address_intervention} />
          <Row label="Code postal / Ville" value={[client.postal_code, client.city].filter(Boolean).join(" ")} />
          <Row label="Adresse de facturation" value={client.address_billing} />
          <Row label="Contact syndic" value={client.contact_syndic} />
          <Row label="Contact locataire" value={client.contact_locataire} />
          <Row label="Clés / codes" value={client.syndic_keys_codes} />
          <Row label="Notes internes" value={client.notes_internal} />
        </CardContent>
      </Card>

      {client.owner && (
        <Card>
          <CardContent className="p-3 grid gap-2 text-sm">
            <p className="font-medium flex items-center gap-1 mb-1"><User className="w-4 h-4" /> Propriétaire</p>
            <Row label="Nom et prénom" value={client.owner.name} />
            <Row label="Téléphone" value={client.owner.phone ? <a className="underline" href={`tel:${client.owner.phone}`}>{client.owner.phone}</a> : null} />
            <Row label="Téléphone 2" value={client.owner.phone_secondary ? <a className="underline" href={`tel:${client.owner.phone_secondary}`}>{client.owner.phone_secondary}</a> : null} />
            <Row label="Email" value={client.owner.email} />
            <Row label="Adresse" value={client.owner.address_intervention} />
          </CardContent>
        </Card>
      )}

      {/* Site */}
      {site && (
        <Card>
          <CardContent className="p-3 grid gap-2 text-sm">
            <p className="font-medium flex items-center gap-1 mb-1"><MapPin className="w-4 h-4" /> Site</p>
            <Row label="Nom" value={site.name} />
            <Row label="Adresse" value={site.address} />
            <Row label="Code postal / Ville" value={[site.postal_code, site.city].filter(Boolean).join(" ")} />
            <Row label="Notes" value={site.notes} />
          </CardContent>
        </Card>
      )}

      {/* Équipement */}
      {equip && (
        <Card>
          <CardContent className="p-3 grid gap-2 text-sm">
            <p className="font-medium flex items-center gap-1 mb-1"><Wrench className="w-4 h-4" /> Équipement</p>
            <Row label="Nom" value={equip.name} />
            <Row label="Énergie" value={ENERGY_TYPE_LABELS[equip.energy_type] || equip.energy_type} />
            <Row label="Marque / Modèle" value={[equip.brand, equip.model].filter(Boolean).join(" ")} />
            <Row label="Périodicité" value={PERIODICITY_LABELS[equip.maintenance_periodicity] || equip.maintenance_periodicity} />
            <Row label="Dernier entretien" value={equip.last_maintenance_date ? format(new Date(equip.last_maintenance_date), "dd/MM/yyyy") : null} />
            <Row label="Prochain entretien" value={equip.next_maintenance_date ? format(new Date(equip.next_maintenance_date), "dd/MM/yyyy") : null} />
            <Row label="Notes" value={equip.notes} />
          </CardContent>
        </Card>
      )}

      {/* Entretien */}
      <div className="grid gap-3 text-sm">
        <Row label="Type" value={INTERVENTION_TYPE_LABELS[schedule.intervention_type] || schedule.intervention_type} />
        <div className="flex justify-between">
          <span className="text-muted-foreground">Périodicité</span>
          <Badge variant="outline">{PERIODICITY_LABELS[schedule.periodicity]}</Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Statut</span>
          <Badge variant={schedule.status === "actif" ? "default" : "secondary"}>{schedule.status}</Badge>
        </div>
        <Row label="Dernier entretien" value={schedule.last_done_date ? format(new Date(schedule.last_done_date), "dd/MM/yyyy") : null} />
        <Row label="Alerte légale" value={schedule.legal_alert_years ? `Tous les ${schedule.legal_alert_years} an(s)` : null} />
        <Row label="Ouvriers assignés" value={assignees.length ? assignees.join(", ") : null} />
        <Row
          label="Binôme"
          value={schedule.task_binomes ? `${schedule.task_binomes.code} — ${schedule.task_binomes.name}` : null}
        />
        <Row
          label="Dernier rappel envoyé"
          value={schedule.reminder_sent_at ? format(new Date(schedule.reminder_sent_at), "dd/MM/yyyy HH:mm") : null}
        />
        <Row
          label="Créé le"
          value={schedule.created_at ? format(new Date(schedule.created_at), "dd/MM/yyyy") : null}
        />
      </div>

      {schedule.notes && (
        <>
          <Separator />
          <Card>
            <CardContent className="p-3 text-sm">
              <p className="font-medium mb-1">Mémo du bureau</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{schedule.notes}</p>
            </CardContent>
          </Card>
        </>
      )}

      <CreateEditEntretienDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        schedule={schedule}
        onSaved={() => { fetchSchedule(); setEditOpen(false); }}
      />

      <CreateTaskDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        hideTrigger
        defaultDate={schedule.next_due_date ? new Date(schedule.next_due_date) : new Date()}
        defaultClientId={schedule.client_id}
        defaultInterventionType={schedule.intervention_type}
        defaultTitle={`${INTERVENTION_TYPE_LABELS[schedule.intervention_type] || "Entretien"} — ${client.name || ""}`.trim()}
        onCreated={() => { setPlanOpen(false); fetchSchedule(); }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet entretien ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'entretien récurrent et ses assignations d'ouvriers seront définitivement supprimés.
              Les tâches et fiches d'intervention déjà planifiées ne sont pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LayoutDetail>
  );
}
