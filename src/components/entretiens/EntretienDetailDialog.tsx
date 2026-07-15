import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { INTERVENTION_TYPE_LABELS, PERIODICITY_LABELS } from "@/lib/constants";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Wrench, MapPin, Calendar, AlertTriangle, Pencil, User, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { sendEntretienReminderToAG } from "@/lib/sendEmailAG";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: any;
  onEdit: () => void;
}

export default function EntretienDetailDialog({ open, onOpenChange, schedule, onEdit }: Props) {
  const [sending, setSending] = useState(false);
  if (!schedule) return null;

  const daysUntilDue = schedule.next_due_date
    ? differenceInDays(new Date(schedule.next_due_date), new Date())
    : null;

  const urgencyLevel = daysUntilDue === null ? "none" : daysUntilDue < 0 ? "overdue" : daysUntilDue <= 30 ? "soon" : "ok";

  const urgencyStyles = {
    overdue: "bg-destructive/10 text-destructive border-destructive/30",
    soon: "alert-warning",
    ok: "alert-success",
    none: "bg-muted text-muted-foreground",
  };

  const legalAlert = schedule.legal_alert_years;

  const handleSendAG = async () => {
    const clientEmail = schedule.clients?.email;
    if (!clientEmail) {
      toast.error("Ce client n'a pas d'adresse email");
      return;
    }
    setSending(true);
    try {
      await sendEntretienReminderToAG(schedule);
      toast.success(`Rappel envoyé à ${clientEmail}`);
    } catch (err) {
      console.error(err);
      toast.error((err as Error)?.message || "Erreur lors de l'envoi de l'email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                {INTERVENTION_TYPE_LABELS[schedule.intervention_type] || schedule.intervention_type}
              </DialogTitle>
              <DialogDescription>Détail de l'entretien</DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="w-4 h-4 mr-1" /> Modifier
            </Button>
          </div>
        </DialogHeader>

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

        {legalAlert && (
          <div className="flex items-center gap-2 text-sm p-2 rounded-md alert-warning border">
            <AlertTriangle className="w-4 h-4" />
            Alerte légale Belgique : tous les {legalAlert} an(s)
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

        <Separator />
        <div className="flex justify-end">
          <Button onClick={handleSendAG} disabled={sending || !schedule.clients?.email} size="sm">
            <Send className="w-4 h-4 mr-1" />
            {sending ? "Envoi..." : "Proposer un RDV au client"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
