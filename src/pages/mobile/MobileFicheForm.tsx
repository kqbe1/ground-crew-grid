import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Save } from "lucide-react";

export default function MobileFicheForm() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [description, setDescription] = useState("");
  const [finalStatus, setFinalStatus] = useState("termine");
  const [clientPresent, setClientPresent] = useState(true);
  const [signatureData, setSignatureData] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (isDraft: boolean) => {
    if (!user || !taskId) return;
    setSubmitting(true);

    const now = new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("intervention_sheets").insert({
      work_task_id: taskId,
      worker_id: user.id,
      arrival_time: arrivalTime ? `${now}T${arrivalTime}:00` : null,
      departure_time: departureTime ? `${now}T${departureTime}:00` : null,
      description,
      final_status: finalStatus as any,
      client_present: clientPresent,
      client_absent: !clientPresent,
      signature_data: signatureData || null,
      signed_at: signatureData ? new Date().toISOString() : null,
      is_draft: isDraft,
    });

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      // Update task status
      await supabase.from("work_tasks").update({ status: finalStatus as any }).eq("id", taskId);
      toast({ title: isDraft ? "Brouillon sauvegardé" : "Fiche envoyée ✓" });
      navigate("/mobile");
    }
    setSubmitting(false);
  };

  return (
    <div className="p-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Retour
      </Button>

      <h1 className="text-xl font-bold">Fiche d'intervention</h1>

      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Heure d'arrivée</Label>
              <Input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Heure de départ</Label>
              <Input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description de l'intervention</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez les travaux réalisés..."
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Statut final</Label>
            <Select value={finalStatus} onValueChange={setFinalStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="termine">Terminé</SelectItem>
                <SelectItem value="piece_a_commander">Pièce à commander</SelectItem>
                <SelectItem value="a_replanifier">À replanifier</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 border-t pt-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="client-absent"
                checked={!clientPresent}
                onCheckedChange={(v) => setClientPresent(!v)}
              />
              <Label htmlFor="client-absent">Client absent</Label>
            </div>

            {clientPresent && (
              <div className="space-y-1.5">
                <Label>Signature du client</Label>
                <div className="border-2 border-dashed border-border rounded-lg h-32 flex items-center justify-center text-muted-foreground text-sm">
                  Zone de signature (à implémenter)
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={submitting}
        >
          <Save className="w-4 h-4 mr-1" /> Brouillon
        </Button>
        <Button
          onClick={() => handleSubmit(false)}
          disabled={submitting}
        >
          <Send className="w-4 h-4 mr-1" /> Envoyer
        </Button>
      </div>
    </div>
  );
}
