import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { INTERVENTION_TYPE_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { ArrowLeft, Phone, MapPin, ClipboardList, MessageSquare, KeyRound, UserRound, Building2, StickyNote, Package } from "lucide-react";
import { toast } from "sonner";

export default function MobileTaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [showPartDialog, setShowPartDialog] = useState(false);
  const [partName, setPartName] = useState("");
  const [partRef, setPartRef] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [partUrgency, setPartUrgency] = useState<"normal" | "urgent" | "critique">("normal");
  const [partNotes, setPartNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchTask = async () => {
      const { data } = await supabase
        .from("work_tasks")
        .select("*, client_sites(address, name), client_equipment(name, brand, model)")
        .eq("id", id)
        .maybeSingle();

      if (data?.client_id) {
        // Fetch full client info including syndic/locataire/keys/notes
        const { data: clientData } = await supabase
          .from("clients")
          .select("id, name, phone, email, address_intervention, contact_syndic, contact_locataire, syndic_keys_codes, notes_internal")
          .eq("id", data.client_id)
          .maybeSingle();
        setTask({ ...data, clients: clientData ?? null });
      } else {
        setTask({ ...data, clients: null });
      }
    };
    if (id) fetchTask();
  }, [id]);

  if (!task) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasClientExtras = task.clients?.contact_syndic || task.clients?.contact_locataire || task.clients?.syndic_keys_codes || task.clients?.notes_internal;

  return (
    <div className="p-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Retour
      </Button>

      <div>
        <h1 className="text-xl font-bold">{task.title}</h1>
        <div className="flex gap-2 mt-1">
          <Badge>{INTERVENTION_TYPE_LABELS[task.intervention_type]}</Badge>
          <Badge variant="outline">{TASK_STATUS_LABELS[task.status]}</Badge>
        </div>
      </div>

      {/* Task details */}
      <Card>
        <CardContent className="py-3 space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Horaire</div>
            <div className="font-medium">{task.start_time?.slice(0, 5)} · {task.duration_minutes} min</div>
          </div>
          {task.description && (
            <div>
              <div className="text-xs text-muted-foreground">Description</div>
              <div className="text-sm">{task.description}</div>
            </div>
          )}
          {task.memo_secretariat && (
            <div className="bg-accent/10 rounded-lg p-3">
              <div className="flex items-center gap-1 text-xs text-accent font-medium mb-1">
                <MessageSquare className="w-3 h-3" /> Mémo secrétariat
              </div>
              <div className="text-sm">{task.memo_secretariat}</div>
            </div>
          )}
          {task.material_needed && (
            <div>
              <div className="text-xs text-muted-foreground">Matériel à prévoir</div>
              <div className="text-sm">🔧 {task.material_needed}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client info */}
      <Card>
        <CardContent className="py-3 space-y-2">
          <div className="font-medium">{task.clients?.name}</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            {task.client_sites?.address || task.clients?.address_intervention}
          </div>
        </CardContent>
      </Card>

      {/* Client extra info (syndic, locataire, clés, notes) */}
      {hasClientExtras && (
        <Card>
          <CardContent className="py-3 space-y-3">
            {task.clients.contact_syndic && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                  <Building2 className="w-3 h-3" /> Contact syndic
                </div>
                <div className="text-sm whitespace-pre-line">{task.clients.contact_syndic}</div>
              </div>
            )}
            {task.clients.contact_locataire && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                  <UserRound className="w-3 h-3" /> Contact locataire
                </div>
                <div className="text-sm whitespace-pre-line">{task.clients.contact_locataire}</div>
              </div>
            )}
            {task.clients.syndic_keys_codes && (
              <div className="bg-primary/10 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs font-medium text-primary mb-1">
                  <KeyRound className="w-3 h-3" /> Codes / Clés syndic
                </div>
                <div className="text-sm whitespace-pre-line">{task.clients.syndic_keys_codes}</div>
              </div>
            )}
            {task.clients.notes_internal && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                  <StickyNote className="w-3 h-3" /> Notes internes
                </div>
                <div className="text-sm whitespace-pre-line">{task.clients.notes_internal}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        {task.clients?.phone && (
          <Button variant="outline" className="w-full" onClick={() => window.location.href = `tel:${task.clients.phone}`}>
            <Phone className="w-4 h-4 mr-2" /> Appeler
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            const addr = task.client_sites?.address || task.clients?.address_intervention;
            if (addr) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`);
          }}
        >
          <MapPin className="w-4 h-4 mr-2" /> GPS
        </Button>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={() => navigate(`/mobile/fiche/${task.id}`)}
      >
        <ClipboardList className="w-5 h-5 mr-2" /> Compléter la fiche
      </Button>

      <Button
        variant="outline"
        className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
        size="lg"
        onClick={() => setShowPartDialog(true)}
      >
        <Package className="w-5 h-5 mr-2" /> Demander une pièce
      </Button>

      {/* Part request dialog */}
      <Dialog open={showPartDialog} onOpenChange={setShowPartDialog}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Demander une pièce</DialogTitle>
            <DialogDescription>La tâche sera marquée « à replanifier » pour le bureau.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
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
            <Button
              className="w-full"
              disabled={!partName.trim() || submitting}
              onClick={async () => {
                if (!user) return;
                setSubmitting(true);
                try {
                  const { error: orderError } = await supabase.from("parts_orders").insert({
                    part_name: partName.trim(),
                    part_reference: partRef.trim() || null,
                    quantity: partQty,
                    urgency: partUrgency,
                    notes: partNotes.trim() || null,
                    work_task_id: task.id,
                    client_id: task.client_id || null,
                    requested_by: user.id,
                    status: "demandee",
                  } as any);
                  if (orderError) throw orderError;

                  const { error: taskError } = await supabase
                    .from("work_tasks")
                    .update({ status: "piece_a_commander" as any })
                    .eq("id", task.id);
                  if (taskError) throw taskError;

                  toast.success("Pièce demandée — tâche marquée à replanifier");
                  setTask({ ...task, status: "piece_a_commander" });
                  setShowPartDialog(false);
                  setPartName("");
                  setPartRef("");
                  setPartQty(1);
                  setPartUrgency("normal");
                  setPartNotes("");
                } catch (err: any) {
                  toast.error("Erreur: " + err.message);
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? "Envoi…" : "Envoyer la demande"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
