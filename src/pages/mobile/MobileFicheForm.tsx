import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineDrafts } from "@/hooks/useOfflineDrafts";
import { toast } from "sonner";
import { ArrowLeft, Send, Save, WifiOff } from "lucide-react";
import SignatureCanvas from "@/components/mobile/SignatureCanvas";
import PhotoCapture from "@/components/mobile/PhotoCapture";
import TimeInput from "@/components/mobile/TimeInput";
import { uploadPhotos, uploadSignature } from "@/lib/storageUpload";

export default function MobileFicheForm() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { save, isOnline } = useOfflineDrafts();

  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [description, setDescription] = useState("");
  const [finalStatus, setFinalStatus] = useState("termine");
  const [clientPresent, setClientPresent] = useState(true);
  const [signatureData, setSignatureData] = useState("");
  const [photosBefore, setPhotosBefore] = useState<string[]>([]);
  const [photosAfter, setPhotosAfter] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (isDraft: boolean) => {
    if (!user || !taskId) return;
    setSubmitting(true);

    const now = new Date().toISOString().split("T")[0];

    // Upload photos & signature to storage if online
    let finalPhotosBefore = photosBefore;
    let finalPhotosAfter = photosAfter;
    let finalSignature = signatureData;

    if (isOnline) {
      try {
        if (photosBefore.length > 0) {
          finalPhotosBefore = await uploadPhotos(photosBefore, user.id);
        }
        if (photosAfter.length > 0) {
          finalPhotosAfter = await uploadPhotos(photosAfter, user.id);
        }
        if (signatureData) {
          finalSignature = await uploadSignature(signatureData, user.id);
        }
      } catch (err) {
        console.error("Storage upload error:", err);
        toast.error("Erreur d'upload — sauvegarde en base64");
      }
    }

    const result = await save({
      work_task_id: taskId,
      worker_id: user.id,
      arrival_time: arrivalTime ? `${now}T${arrivalTime}:00` : null,
      departure_time: departureTime ? `${now}T${departureTime}:00` : null,
      description,
      final_status: finalStatus,
      client_present: clientPresent,
      client_absent: !clientPresent,
      signature_data: finalSignature || null,
      signed_at: signatureData ? new Date().toISOString() : null,
      photos_before: finalPhotosBefore.length > 0 ? finalPhotosBefore : null,
      photos_after: finalPhotosAfter.length > 0 ? finalPhotosAfter : null,
      is_draft: isDraft,
    });

    setSubmitting(false);

    if (result.synced) {
      toast.success(isDraft ? "Brouillon sauvegardé" : "Fiche envoyée ✓");
    } else {
      toast.success("Sauvegardé localement — sera envoyé au retour réseau", {
        icon: <WifiOff className="w-4 h-4" />,
      });
    }
    navigate("/mobile");
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour
        </Button>
        {!isOnline && (
          <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-[hsl(var(--color-replanifier))]/10 text-[hsl(var(--color-replanifier))]">
            <WifiOff className="w-3 h-3" /> Hors ligne
          </div>
        )}
      </div>

      <h1 className="text-xl font-bold">Fiche d'intervention</h1>

      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Heure d'arrivée</Label>
              <TimeInput value={arrivalTime} onChange={setArrivalTime} />
            </div>
            <div className="space-y-1.5">
              <Label>Heure de départ</Label>
              <TimeInput value={departureTime} onChange={setDepartureTime} />
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

          <div className="grid grid-cols-1 gap-4 border-t pt-3">
            <PhotoCapture label="📸 Photos AVANT" photos={photosBefore} onPhotosChange={setPhotosBefore} />
            <PhotoCapture label="📸 Photos APRÈS" photos={photosAfter} onPhotosChange={setPhotosAfter} />
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
                <SignatureCanvas value={signatureData} onSignatureChange={setSignatureData} />
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
