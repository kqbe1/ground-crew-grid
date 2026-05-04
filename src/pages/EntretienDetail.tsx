import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { INTERVENTION_TYPE_LABELS, PERIODICITY_LABELS } from "@/lib/constants";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Wrench, MapPin, Calendar, AlertTriangle, Pencil, User, Loader2 } from "lucide-react";
import LayoutDetail from "@/components/layout/LayoutDetail";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import CreateEditEntretienDialog from "@/components/entretiens/CreateEditEntretienDialog";

export default function EntretienDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const fetchSchedule = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("maintenance_schedules")
      .select("*, clients(name), client_sites(address), client_equipment(name, brand, model)")
      .eq("id", id)
      .single();
    setSchedule(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  if (loading) return <LayoutDetail loading resourceLabel="Entretien">{null}</LayoutDetail>;
  if (!schedule) return <LayoutDetail notFound resourceLabel="Entretien">{null}</LayoutDetail>;

  const daysUntilDue = schedule.next_due_date ? differenceInDays(new Date(schedule.next_due_date), new Date()) : null;
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
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="w-4 h-4 mr-1" /> Modifier
        </Button>
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

      <div className="grid gap-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Client</span>
          <span className="font-medium flex items-center gap-1"><User className="w-3 h-3" /> {schedule.clients?.name || "—"}</span>
        </div>
        {schedule.client_sites?.address && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Site</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {schedule.client_sites.address}</span>
          </div>
        )}
        {schedule.client_equipment && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Équipement</span>
            <span>{schedule.client_equipment.name} {schedule.client_equipment.brand && `(${schedule.client_equipment.brand} ${schedule.client_equipment.model || ""})`}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Périodicité</span>
          <Badge variant="outline">{PERIODICITY_LABELS[schedule.periodicity]}</Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Statut</span>
          <Badge variant={schedule.status === "actif" ? "default" : "secondary"}>{schedule.status}</Badge>
        </div>
        {schedule.last_done_date && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dernier entretien</span>
            <span>{format(new Date(schedule.last_done_date), "dd/MM/yyyy")}</span>
          </div>
        )}
      </div>

      {schedule.notes && (
        <>
          <Separator />
          <Card>
            <CardContent className="p-3 text-sm">
              <p className="font-medium mb-1">Notes</p>
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
    </LayoutDetail>
  );
}
