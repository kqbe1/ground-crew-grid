import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { Package, AlertTriangle, User, FileText, Trash2, Check } from "lucide-react";
import LayoutDetail from "@/components/layout/LayoutDetail";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import CreateFollowUpTaskDialog from "@/components/commandes/CreateFollowUpTaskDialog";

const statusColors: Record<string, string> = {
  demandee: "bg-order-demandee text-white",
  commandee: "bg-order-commandee text-white",
  recue: "bg-order-recue text-white",
  cloturee: "bg-order-cloturee text-white",
};

export default function CommandeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("parts_orders")
      .select("*, clients(name), work_tasks(title), profiles!parts_orders_requested_by_fkey(full_name)")
      .eq("id", id)
      .single();
    setOrder(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const setStatus = async (next: string) => {
    if (!order || order.status === next) return;
    const updates: any = { status: next };
    if (next === "commandee" && !order.ordered_at) updates.ordered_at = new Date().toISOString();
    if (next === "recue" && !order.received_at) updates.received_at = new Date().toISOString();
    if (next === "cloturee" && !order.closed_at) updates.closed_at = new Date().toISOString();

    const { error } = await supabase.from("parts_orders").update(updates).eq("id", order.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Statut → ${ORDER_STATUS_LABELS[next]}`);

    if (next === "recue" && order.client_id) {
      setShowFollowUp(true);
    }
    fetchOrder();
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("parts_orders").delete().eq("id", id!);
    if (error) { toast.error(error.message); return; }
    toast.success("Commande supprimée");
    navigate(-1);
  };

  if (loading) return <LayoutDetail loading resourceLabel="Commande">{null}</LayoutDetail>;
  if (!order) return <LayoutDetail notFound resourceLabel="Commande">{null}</LayoutDetail>;

  const steps = ["demandee", "commandee", "recue", "cloturee"];
  const currentIdx = steps.indexOf(order.status);

  return (
    <LayoutDetail
      icon={<Package className="w-5 h-5" />}
      title={order.part_name}
      subtitle={`${order.clients?.name ?? "—"} · ${format(new Date(order.created_at), "d MMMM yyyy", { locale: fr })}`}
      hideSeparator
      toolbar={
        <>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive"><Trash2 className="w-4 h-4 mr-1" /> Supprimer</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette commande ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      }
    >
      {/* Status stepper compact */}
      <div className="rounded-lg border bg-card p-4">
        <div className="relative flex items-center justify-between">
          {/* connecting line behind circles */}
          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-muted" />
          <div
            className="absolute left-4 top-1/2 -translate-y-1/2 h-0.5 bg-primary transition-all"
            style={{ width: `calc((100% - 2rem) * ${currentIdx / (steps.length - 1)})` }}
          />
          {steps.map((step, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={step} className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 border-background shadow-sm",
                    done || active ? statusColors[step] : "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={cn("text-[11px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                  {ORDER_STATUS_LABELS[step]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Status action buttons */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center mr-1">Changer le statut :</span>
          {steps.map((step) => {
            const isCurrent = step === order.status;
            return (
              <Button
                key={step}
                size="sm"
                variant={isCurrent ? "default" : "outline"}
                disabled={isCurrent}
                onClick={() => setStatus(step)}
                className={cn(isCurrent && statusColors[step])}
              >
                {ORDER_STATUS_LABELS[step]}
              </Button>
            );
          })}
        </div>
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

        <Separator />
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Créée</span><span>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span></div>
          {order.ordered_at && <div className="flex justify-between"><span>Commandée</span><span>{format(new Date(order.ordered_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span></div>}
          {order.received_at && <div className="flex justify-between"><span>Reçue</span><span>{format(new Date(order.received_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span></div>}
          {order.closed_at && <div className="flex justify-between"><span>Clôturée</span><span>{format(new Date(order.closed_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span></div>}
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

      <CreateFollowUpTaskDialog
        open={showFollowUp}
        onOpenChange={(o) => { setShowFollowUp(o); if (!o) fetchOrder(); }}
        order={order}
        onCreated={() => { setShowFollowUp(false); fetchOrder(); }}
      />
    </LayoutDetail>
  );
}
