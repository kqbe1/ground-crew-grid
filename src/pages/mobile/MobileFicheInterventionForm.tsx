import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineDrafts } from "@/hooks/useOfflineDrafts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { uploadPhotos, uploadSignature } from "@/lib/storageUpload";

import StepProgressBar from "@/components/mobile/steps/StepProgressBar";
import StepNavigation from "@/components/mobile/steps/StepNavigation";
import CoordinatesStep, { type CoordinatesData } from "@/components/mobile/steps/CoordinatesStep";
import PhotoStep from "@/components/mobile/steps/PhotoStep";
import NameplateStep, { type NameplateData, emptyNameplate } from "@/components/mobile/steps/NameplateStep";
import HoursStatusStep, { type HoursStatusData } from "@/components/mobile/steps/HoursStatusStep";
import SignatureStep, { type SignatureData } from "@/components/mobile/steps/SignatureStep";
import InternalStep from "@/components/mobile/steps/InternalStep";
import { Textarea } from "@/components/ui/textarea";

const TOTAL_STEPS = 9;

export default function MobileFicheInterventionForm() {
  const { taskId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { isOnline, save } = useOfflineDrafts();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [coords, setCoords] = useState<CoordinatesData>({
    clientName: "", clientAddress: "", clientPostal: "", clientCity: "",
    clientPhone: "", clientEmail: "", billingSame: true, billingName: "",
    billingAddress: "", billingPostal: "", billingCity: "", billingPhone: "", billingEmail: "",
  });
  const [photosBefore, setPhotosBefore] = useState<string[]>([]);
  const [observationsBefore, setObservationsBefore] = useState("");
  const [nameplate, setNameplate] = useState<NameplateData>(emptyNameplate);
  const [nameplatePhotos, setNameplatePhotos] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [supplies, setSupplies] = useState("");
  const [photosAfter, setPhotosAfter] = useState<string[]>([]);
  const [hoursStatus, setHoursStatus] = useState<HoursStatusData>({
    arrivalTime: "", departureTime: "", statusDetail: "", statusComment: "",
  });
  const [signature, setSignature] = useState<SignatureData>({
    technicianName: profile?.full_name || "",
    binomeName: "", binomePercentage: 0, clientAbsent: false, signatureData: "",
  });
  const [internalComment, setInternalComment] = useState("");
  const [internalPhotos, setInternalPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!taskId) return;
    (async () => {
      const { data: task } = await supabase
        .from("work_tasks")
        .select("*, clients(name, address_intervention, phone, email, address_billing)")
        .eq("id", taskId)
        .maybeSingle();
      if (task?.clients) {
        const c = task.clients as any;
        setCoords((prev) => ({
          ...prev,
          clientName: c.name || "",
          clientAddress: c.address_intervention || "",
          clientPhone: c.phone || "",
          clientEmail: c.email || "",
        }));
      }
    })();
  }, [taskId]);

  useEffect(() => {
    if (profile?.full_name) {
      setSignature((prev) => ({ ...prev, technicianName: profile.full_name }));
    }
  }, [profile?.full_name]);

  const handleClose = () => {
    if (dirty && !confirm("Quitter sans enregistrer ?")) return;
    navigate(-1);
  };

  const validateStep = (): boolean => {
    switch (step) {
      case 1: return !!coords.clientName.trim();
      case 7: return !!hoursStatus.statusDetail;
      default: return true;
    }
  };

  const handleNext = async () => {
    if (!validateStep()) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const mapStatusToFinal = (detail: string): string => {
    const map: Record<string, string> = {
      termine: "termine", piece_a_commander: "piece_a_commander",
      piece_commandee: "piece_a_commander", a_refixer: "a_replanifier",
      sav: "sav", autre: "planifie",
    };
    return map[detail] || "termine";
  };

  const buildPayload = (
    finalPhotosBefore: string[], finalPhotosAfter: string[],
    finalNameplatePhotos: string[], finalInternalPhotos: string[],
    finalSignature: string,
  ) => {
    const now = new Date().toISOString().split("T")[0];
    return {
      work_task_id: taskId,
      worker_id: user!.id,
      arrival_time: hoursStatus.arrivalTime ? `${now}T${hoursStatus.arrivalTime}:00` : null,
      departure_time: hoursStatus.departureTime ? `${now}T${hoursStatus.departureTime}:00` : null,
      description,
      final_status: mapStatusToFinal(hoursStatus.statusDetail),
      client_present: !signature.clientAbsent,
      client_absent: signature.clientAbsent,
      signature_data: finalSignature || null,
      signed_at: signature.signatureData ? new Date().toISOString() : null,
      photos_before: finalPhotosBefore.length > 0 ? finalPhotosBefore : null,
      photos_after: finalPhotosAfter.length > 0 ? finalPhotosAfter : null,
      is_draft: false,
      nameplate_data: nameplate,
      photos_nameplate: finalNameplatePhotos,
      supplies_description: supplies || null,
      internal_comment: internalComment || null,
      internal_photos: finalInternalPhotos,
      observations_before: observationsBefore || null,
      billing_same_as_intervention: coords.billingSame,
      billing_name: coords.billingName || null,
      billing_address: coords.billingAddress || null,
      billing_postal_code: coords.billingPostal || null,
      billing_city: coords.billingCity || null,
      billing_phone: coords.billingPhone || null,
      billing_email: coords.billingEmail || null,
      client_name_override: coords.clientName || null,
      client_address_override: coords.clientAddress || null,
      client_postal_override: coords.clientPostal || null,
      client_city_override: coords.clientCity || null,
      client_phone_override: coords.clientPhone || null,
      client_email_override: coords.clientEmail || null,
      binome_name: signature.binomeName || null,
      binome_percentage: signature.binomePercentage || null,
      work_status_detail: hoursStatus.statusDetail || null,
      status_comment: hoursStatus.statusComment || null,
    };
  };

  const handleSubmit = async () => {
    if (!user || !taskId) return;
    setSubmitting(true);

    try {
      let finalPhotosBefore = photosBefore;
      let finalPhotosAfter = photosAfter;
      let finalNameplatePhotos = nameplatePhotos;
      let finalInternalPhotos = internalPhotos;
      let finalSignature = signature.signatureData;

      if (isOnline) {
        if (photosBefore.length > 0) finalPhotosBefore = await uploadPhotos(photosBefore, user.id);
        if (photosAfter.length > 0) finalPhotosAfter = await uploadPhotos(photosAfter, user.id);
        if (nameplatePhotos.length > 0) finalNameplatePhotos = await uploadPhotos(nameplatePhotos, user.id);
        if (internalPhotos.length > 0) finalInternalPhotos = await uploadPhotos(internalPhotos, user.id);
        if (finalSignature && !finalSignature.startsWith("http")) {
          finalSignature = await uploadSignature(finalSignature, user.id);
        }
      }

      const payload = buildPayload(finalPhotosBefore, finalPhotosAfter, finalNameplatePhotos, finalInternalPhotos, finalSignature);

      const result = await save({
        work_task_id: taskId,
        worker_id: user.id,
        final_status: payload.final_status,
        payload,
      });

      if (result.synced) {
        toast.success("Fiche envoyée ✓");
      } else {
        toast.success("Sauvegardé localement — sera envoyé au retour réseau", {
          icon: <WifiOff className="w-4 h-4" />,
        });
      }
      navigate("/mobile");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'envoi de la fiche");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = <T,>(setter: (v: T) => void) => (v: T) => {
    setDirty(true);
    setter(v);
  };

  const renderStep = () => {
    switch (step) {
      case 1: return <CoordinatesStep data={coords} onChange={handleChange(setCoords)} />;
      case 2: return (
        <PhotoStep title="Photos avant travaux" sectionLabel="Photos avant travaux"
          photos={photosBefore} onPhotosChange={handleChange(setPhotosBefore)}
          showObservations observations={observationsBefore}
          onObservationsChange={handleChange(setObservationsBefore)} />
      );
      case 3: return (
        <NameplateStep data={nameplate} onChange={handleChange(setNameplate)}
          photos={nameplatePhotos} onPhotosChange={handleChange(setNameplatePhotos)} />
      );
      case 4: return (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Description du travail</h2>
          <Textarea value={description}
            onChange={(e) => { setDirty(true); setDescription(e.target.value); }}
            placeholder="Décrivez le travail effectué ici..." rows={6} />
        </div>
      );
      case 5: return (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Fournitures</h2>
          <div className="bg-muted/50 rounded-lg px-3 py-2">
            <span className="text-sm font-semibold text-muted-foreground">Fournitures utilisées</span>
          </div>
          <Textarea value={supplies}
            onChange={(e) => { setDirty(true); setSupplies(e.target.value); }}
            placeholder="Décrivez les fournitures utilisées..." rows={4} />
        </div>
      );
      case 6: return (
        <PhotoStep title="Photos après travaux" sectionLabel="Photos après travaux"
          photos={photosAfter} onPhotosChange={handleChange(setPhotosAfter)} />
      );
      case 7: return <HoursStatusStep data={hoursStatus} onChange={handleChange(setHoursStatus)} />;
      case 8: return <SignatureStep data={signature} onChange={handleChange(setSignature)} />;
      case 9: return (
        <InternalStep title="Commentaire interne & Achats"
          internalComment={internalComment} onCommentChange={handleChange(setInternalComment)}
          internalPhotos={internalPhotos} onPhotosChange={handleChange(setInternalPhotos)} />
      );
      default: return null;
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      <StepProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />
      <div className="flex items-center justify-between">
        <StepNavigation currentStep={step} totalSteps={TOTAL_STEPS}
          onNext={handleNext} onBack={handleBack} onClose={handleClose}
          nextDisabled={!validateStep()} isSubmitting={submitting} />
      </div>
      {!isOnline && (
        <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full alert-warning w-fit">
          <WifiOff className="w-3 h-3" /> Hors ligne
        </div>
      )}
      {renderStep()}
    </div>
  );
}
