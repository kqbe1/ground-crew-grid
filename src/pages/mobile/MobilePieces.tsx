import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { Package, Plus } from "lucide-react";
import PhotoCapture from "@/components/mobile/PhotoCapture";
import { uploadPhotos } from "@/lib/storageUpload";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  demandee: "bg-order-demandee text-white",
  commandee: "bg-order-commandee text-white",
  recue: "bg-order-recue text-white",
  cloturee: "bg-order-cloturee text-white",
};

export default function MobilePieces() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [partName, setPartName] = useState("");
  const [partRef, setPartRef] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [partUrgency, setPartUrgency] = useState<"normal" | "urgent" | "critique">("normal");
  const [partNotes, setPartNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskId, setTaskId] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [ordersRes, clientsRes, tasksRes] = await Promise.all([
        supabase
          .from("parts_orders")
          .select("*, work_tasks(title)")
          .eq("requested_by", user.id)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_my_clients_safe"),
        supabase
          .from("work_tasks")
          .select("id, title, scheduled_date, client_id")
          .or(`assigned_to.eq.${user.id},second_assigned_to.eq.${user.id}`)
          .order("scheduled_date", { ascending: false })
          .limit(60),
      ]);
      const clientMap = Object.fromEntries(
        (clientsRes.data ?? []).map((c: any) => [c.id, c])
      );
      const enriched = (ordersRes.data ?? []).map((o: any) => ({
        ...o,
        clients: o.client_id ? clientMap[o.client_id] ?? null : null,
      }));
      setOrders(enriched);
      setTasks(
        (tasksRes.data ?? []).map((t: any) => ({
          ...t,
          clientName: t.client_id ? clientMap[t.client_id]?.name ?? null : null,
        })),
      );
    };
    fetch();
  }, [user, reloadKey]);

  const reset = () => {
    setPartName(""); setPartRef(""); setPartQty(1);
    setPartUrgency("normal"); setPartNotes(""); setPhotos([]); setTaskId("");
  };

  const submit = async () => {
    if (!user || !partName.trim() || !taskId) return;
    setSubmitting(true);
    try {
      let uploaded: string[] = photos;
      if (photos.length > 0) {
        uploaded = await uploadPhotos(photos, user.id);
      }
      const task = tasks.find((t) => t.id === taskId);
      const { error } = await supabase.from("parts_orders").insert({
        part_name: partName.trim(),
        part_reference: partRef.trim() || null,
        quantity: partQty,
        urgency: partUrgency,
        notes: partNotes.trim() || null,
        requested_by: user.id,
        status: "demandee",
        work_task_id: taskId,
        client_id: task?.client_id ?? null,
        photos: uploaded.length > 0 ? uploaded : null,
      } as any);
      if (error) throw error;
      toast.success("Demande de pièce envoyée");
      reset();
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err: any) {
      toast.error("Erreur: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mes pièces</h1>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Demander
        </Button>
      </div>
      <div className="space-y-2">
        {orders.map((o) => (
          <Card key={o.id}>
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">{o.part_name}</div>
                  <div className="text-sm text-muted-foreground">{o.clients?.name} · Qté: {o.quantity}</div>
                  {o.work_tasks?.title && (
                    <div className="text-xs text-muted-foreground truncate">Tâche : {o.work_tasks.title}</div>
                  )}
                </div>
                <Badge className={statusColors[o.status]}>
                  {ORDER_STATUS_LABELS[o.status]}
                </Badge>
              </div>
              {o.photos && o.photos.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5">
                  {o.photos.slice(0, 4).map((p: string, i: number) => (
                    <img key={i} src={p} alt={`pièce ${i + 1}`} className="w-full aspect-square object-cover rounded" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">Aucune demande de pièce</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-[360px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Demander une pièce</DialogTitle>
            <DialogDescription>Le bureau sera notifié de votre demande.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tâche liée *</Label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner la tâche" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.scheduled_date?.split("-").reverse().join("/")} · {t.title}
                      {t.clientName ? ` — ${t.clientName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tasks.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Aucune tâche assignée trouvée.</p>
              )}
            </div>
            <div>
              <Label>Nom de la pièce *</Label>
              <Input value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="Ex: Vanne 3 voies" />
            </div>
            <div>
              <Label>Référence</Label>
              <Input value={partRef} onChange={(e) => setPartRef(e.target.value)} placeholder="Optionnel" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantité</Label>
                <Input type="number" min={1} value={partQty} onChange={(e) => setPartQty(Number(e.target.value) || 1)} />
              </div>
              <div>
                <Label>Urgence</Label>
                <Select value={partUrgency} onValueChange={(v: any) => setPartUrgency(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="critique">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={partNotes} onChange={(e) => setPartNotes(e.target.value)} placeholder="Infos complémentaires…" rows={2} />
            </div>
            <PhotoCapture label="Photos de la pièce" photos={photos} onPhotosChange={setPhotos} />
            <Button className="w-full" disabled={!partName.trim() || !taskId || submitting} onClick={submit}>
              {submitting ? "Envoi…" : "Envoyer la demande"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
