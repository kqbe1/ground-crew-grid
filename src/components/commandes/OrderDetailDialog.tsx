import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, ArrowRight, AlertTriangle, User, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import CreateFollowUpTaskDialog from "./CreateFollowUpTaskDialog";

const statusColors: Record<string, string> = {
  demandee: "bg-order-demandee text-white",
  commandee: "bg-order-commandee text-white",
  recue: "bg-order-recue text-white",
  cloturee: "bg-order-cloturee text-white",
};

const WORKFLOW: Record<string, { next: string | null; label: string; color: string }> = {
  demandee: { next: "commandee", label: "Marquer comme Commandée", color: "bg-order-commandee hover:bg-order-commandee/90 text-white" },
  commandee: { next: "recue", label: "Marquer comme Reçue", color: "bg-order-recue hover:bg-order-recue/90 text-white" },
  recue: { next: "cloturee", label: "Clôturer", color: "bg-order-cloturee hover:bg-order-cloturee/90 text-white" },
  cloturee: { next: null, label: "", color: "" },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  onUpdated: () => void;
}

export default function OrderDetailDialog({ open, onOpenChange, order, onUpdated }: Props) {
  const [showFollowUp, setShowFollowUp] = useState(false);

  if (!order) return null;

  const workflow = WORKFLOW[order.status];

  const advanceStatus = async () => {
    if (!workflow?.next) return;
    const updates: any = { status: workflow.next };
    if (workflow.next === "commandee") updates.ordered_at = new Date().toISOString();
    if (workflow.next === "recue") updates.received_at = new Date().toISOString();
    if (workflow.next === "cloturee") updates.closed_at = new Date().toISOString();

    const { error } = await supabase.from("parts_orders").update(updates).eq("id", order.id);
    if (error) { toast.error(error.message); return; }

    toast.success(`Statut changé → ${ORDER_STATUS_LABELS[workflow.next]}`);

    // Si on passe à "Reçue", proposer de créer une tâche de suite
    if (workflow.next === "recue" && order.client_id) {
      setShowFollowUp(true);
      // Don't call onUpdated yet — wait for follow-up dialog to close
      return;
    }

    onUpdated();
  };

  const steps = ["demandee", "commandee", "recue", "cloturee"];
  const currentIdx = steps.indexOf(order.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" /> {order.part_name}
          </DialogTitle>
          <DialogDescription>Détail de la commande</DialogDescription>
        </DialogHeader>

        {/* Status workflow stepper */}
        <div className="flex items-center justify-between py-3">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                i <= currentIdx ? statusColors[step] : "bg-muted text-muted-foreground"
              )}>
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className={cn("w-4 h-4 mx-1", i < currentIdx ? "text-primary" : "text-muted-foreground")} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          {steps.map((s) => <span key={s}>{ORDER_STATUS_LABELS[s]}</span>)}
        </div>

        <Separator />

        {/* Details */}
        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Statut</span>
            <Badge className={cn(statusColors[order.status])}>{ORDER_STATUS_LABELS[order.status]}</Badge>
          </div>
          {order.urgency !== "normal" && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Urgence</span>
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                {order.urgency === "critique" ? "Critique" : "Urgent"}
              </Badge>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Quantité</span>
            <span>{order.quantity}</span>
          </div>
          {order.part_reference && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Référence</span>
              <span className="font-mono text-xs">{order.part_reference}</span>
            </div>
          )}
          {order.supplier && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fournisseur</span>
              <span>{order.supplier}</span>
            </div>
          )}
          {order.clients?.name && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Client</span>
              <span>{order.clients.name}</span>
            </div>
          )}
          {order.work_tasks?.title && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Travail lié</span>
              <span className="truncate max-w-[200px]">{order.work_tasks.title}</span>
            </div>
          )}
          {order.profiles?.full_name && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Demandé par</span>
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {order.profiles.full_name}</span>
            </div>
          )}

          {/* Dates */}
          <Separator />
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Créée</span>
              <span>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span>
            </div>
            {order.ordered_at && (
              <div className="flex justify-between">
                <span>Commandée</span>
                <span>{format(new Date(order.ordered_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span>
              </div>
            )}
            {order.received_at && (
              <div className="flex justify-between">
                <span>Reçue</span>
                <span>{format(new Date(order.received_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span>
              </div>
            )}
            {order.closed_at && (
              <div className="flex justify-between">
                <span>Clôturée</span>
                <span>{format(new Date(order.closed_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span>
              </div>
            )}
          </div>

          {order.notes && (
            <Card>
              <CardContent className="p-3 text-sm">
                <p className="font-medium mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Notes</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action button */}
        {workflow?.next && (
          <Button className={cn("w-full mt-2", workflow.color)} onClick={advanceStatus}>
            <ArrowRight className="w-4 h-4 mr-2" /> {workflow.label}
          </Button>
        )}
      </DialogContent>

      <CreateFollowUpTaskDialog
        open={showFollowUp}
        onOpenChange={setShowFollowUp}
        order={order}
        onCreated={() => {
          setShowFollowUp(false);
          onUpdated();
        }}
      />
    </Dialog>
  );
}
