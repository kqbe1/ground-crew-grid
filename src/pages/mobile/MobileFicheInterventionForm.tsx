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
import PhotoStep from "@/components/mobile/steps/PhotoStep";
import NameplateStep, { type NameplateData, emptyNameplate } from "@/components/mobile/steps/NameplateStep";
import HoursStatusStep, { type HoursStatusData } from "@/components/mobile/steps/HoursStatusStep";
import SignatureStep, { type SignatureData } from "@/components/mobile/steps/SignatureStep";
import InternalStep from "@/components/mobile/steps/InternalStep";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

const TOTAL_STEPS = 8;

const draftKey = (taskId?: string) => `fiche_draft:intervention:${taskId ?? "new"}`;
function loadDraft(taskId?: string): any | null {
  try {
    const raw = localStorage.getItem(draftKey(taskId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearDraft(taskId?: string) {
  try { localStorage.removeItem(draftKey(taskId)); } catch {}
}

export default function MobileFicheInterventionForm() {
  const { taskId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { isOnline, save } = useOfflineDrafts();
  const _draft = loadDraft(taskId);
  const [step, setStep] = useState<number>(_draft?.step ?? 1);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState<boolean>(!!_draft);
  const [hasDraft, setHasDraft] = useState<boolean>(!!_draft);

  const [readOnly, setReadOnly] = useState<boolean>(false);
  const [photosBefore, setPhotosBefore] = useState<string[]>(_draft?.photosBefore ?? []);
  const [observationsBefore, setObservationsBefore] = useState<string>(_draft?.observationsBefore ?? "");
  const [nameplate, setNameplate] = useState<NameplateData>(_draft?.nameplate ?? emptyNameplate);
  const [nameplatePhotos, setNameplatePhotos] = useState<string[]>(_draft?.nameplatePhotos ?? []);
  const [description, setDescription] = useState<string>(_draft?.description ?? "");
  const [supplies, setSupplies] = useState<string>(_draft?.supplies ?? "");
  const [photosAfter, setPhotosAfter] = useState<string[]>(_draft?.photosAfter ?? []);
  const [hoursStatus, setHoursStatus] = useState<HoursStatusData>(_draft?.hoursStatus ?? {
    arrivalTime: "", departureTime: "", statusDetail: "", statusDetails: [], statusNotes: {},
  });
  const [signature, setSignature] = useState<SignatureData>(_draft?.signature ?? {
    technicianName: profile?.full_name || "",
    binomeName: "", binomePercentage: 0, clientAbsent: false, signatureData: "",
  });
  const [internalComment, setInternalComment] = useState<string>(_draft?.internalComment ?? "");
  const [internalPhotos, setInternalPhotos] = useState<string[]>(_draft?.internalPhotos ?? []);

  useEffect(() => {
    if (!taskId) return;
    // Vérifie si une fiche envoyée existe : bascule en lecture seule
    (async () => {
      const { data: existing } = await supabase
        .from("intervention_sheets")
        .select("id, is_draft")
        .eq("work_task_id", taskId)
        .eq("is_draft", false)
        .maybeSingle();
      if (existing) setReadOnly(true);
    })();
    const draftLoaded = loadDraft(taskId);
    if (draftLoaded) toast.info("Brouillon repris");
    // Toujours récupérer le binôme de la tâche — pré-remplit la signature
    // si le champ est encore vide (nouvelle fiche OU brouillon créé avant l'ajout).
    (async () => {
      const { data: task } = await supabase
        .from("work_tasks")
        .select("*, clients(name), binome:task_binomes!work_tasks_binome_id_fkey(name, code, kind)")
        .eq("id", taskId)
        .maybeSingle();
      const binome = (task as any)?.binome;
      if (binome?.name) {
        setSignature((prev) =>
          prev.binomeName?.trim()
            ? prev
            : { ...prev, binomeName: `${binome.code} — ${binome.name}` },
        );
      }
    })();
  }, [taskId]);

  useEffect(() => {
    if (profile?.full_name) {
      setSignature((prev) => ({ ...prev, technicianName: profile.full_name }));
    }
  }, [profile?.full_name]);

  // Persistance globale du brouillon (debounce 300ms)
  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey(taskId), JSON.stringify({
          savedAt: Date.now(),
          step, photosBefore, observationsBefore, nameplate, nameplatePhotos,
          description, supplies, photosAfter, hoursStatus, signature,
          internalComment, internalPhotos,
        }));
        setHasDraft(true);
      } catch { /* quota dépassé — ignoré */ }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [taskId, step, photosBefore, observationsBefore, nameplate, nameplatePhotos,
      description, supplies, photosAfter, hoursStatus, signature, internalComment, internalPhotos]);

  const handleClose = () => {
    if (dirty && !confirm("Quitter sans enregistrer ?")) return;
    clearDraft(taskId);
    navigate(-1);
  };

  const handleDeleteDraft = () => {
    if (!confirm("Supprimer définitivement le brouillon ?")) return;
    clearDraft(taskId);
    setHasDraft(false);
    toast.success("Brouillon supprimé");
    navigate(-1);
  };

  const validateStep = (): boolean => {
    switch (step) {
      case 6: return (hoursStatus.statusDetails?.length ?? 0) > 0;
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

  const mapStatusToFinal = (details: string[]): string => {
    // Priorité : piece_a_commander > sav > a_refixer > termine > autre
    const priority = ["piece_a_commander", "piece_commandee", "sav", "a_refixer", "termine", "autre"];
    const map: Record<string, string> = {
      termine: "termine", piece_a_commander: "piece_a_commander",
      piece_commandee: "piece_a_commander", a_refixer: "a_replanifier",
      sav: "sav", autre: "planifie",
    };
    for (const p of priority) {
      if (details.includes(p)) return map[p];
    }
    return "termine";
  };

  const buildPayload = (
    finalPhotosBefore: string[], finalPhotosAfter: string[],
    finalNameplatePhotos: string[], finalInternalPhotos: string[],
    finalSignature: string,
  ) => {
    const now = new Date().toISOString().split("T")[0];
    const details = hoursStatus.statusDetails ?? (hoursStatus.statusDetail ? [hoursStatus.statusDetail] : []);
    return {
      work_task_id: taskId,
      worker_id: user!.id,
      arrival_time: hoursStatus.arrivalTime ? `${now}T${hoursStatus.arrivalTime}:00` : null,
      departure_time: hoursStatus.departureTime ? `${now}T${hoursStatus.departureTime}:00` : null,
      description,
      final_status: mapStatusToFinal(details),
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
      binome_name: signature.binomeName || null,
      binome_percentage: signature.binomePercentage || null,
      work_status_detail: details[0] || null,
      work_status_details: details.length > 0 ? details : null,
      work_status_notes: hoursStatus.statusNotes ?? {},
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
      clearDraft(taskId);
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
      case 1: return (
        <PhotoStep title="Photos avant travaux" sectionLabel="Photos avant travaux"
          photos={photosBefore} onPhotosChange={handleChange(setPhotosBefore)}
          showObservations observations={observationsBefore}
          onObservationsChange={handleChange(setObservationsBefore)} />
      );
      case 2: return (
        <NameplateStep data={nameplate} onChange={handleChange(setNameplate)}
          photos={nameplatePhotos} onPhotosChange={handleChange(setNameplatePhotos)} />
      );
      case 3: return (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Description du travail</h2>
          <Textarea value={description}
            onChange={(e) => { setDirty(true); setDescription(e.target.value); }}
            placeholder="Décrivez le travail effectué ici..." rows={6} />
        </div>
      );
      case 4: return (
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
      case 5: return (
        <PhotoStep title="Photos après travaux" sectionLabel="Photos après travaux"
          photos={photosAfter} onPhotosChange={handleChange(setPhotosAfter)} />
      );
      case 6: return <HoursStatusStep data={hoursStatus} onChange={handleChange(setHoursStatus)} />;
      case 7: return <SignatureStep data={signature} onChange={handleChange(setSignature)} />;
      case 8: return (
        <InternalStep title="Commentaire interne & Achats"
          internalComment={internalComment} onCommentChange={handleChange(setInternalComment)}
          internalPhotos={internalPhotos} onPhotosChange={handleChange(setInternalPhotos)} />
      );
      default: return null;
    }
  };

  if (readOnly) {
    return (
      <div className="p-4 space-y-3">
        <div className="rounded-lg border border-status-termine/30 bg-status-termine/10 p-4 text-sm">
          Cette fiche a déjà été envoyée. Seul le bureau peut la modifier maintenant.
        </div>
        <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>Retour</Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <StepProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />
      <div className="flex items-center justify-between">
        <StepNavigation currentStep={step} totalSteps={TOTAL_STEPS}
          onNext={handleNext} onBack={handleBack} onClose={handleClose}
          nextDisabled={!validateStep()} isSubmitting={submitting} />
      </div>
      {hasDraft && (
        <div className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-md bg-status-replanifier/10 border border-status-replanifier/30">
          <span className="font-medium text-status-replanifier">Brouillon en cours</span>
          <button type="button" onClick={handleDeleteDraft} className="flex items-center gap-1 text-status-replanifier hover:underline">
            <Trash2 className="w-3 h-3" /> Supprimer
          </button>
        </div>
      )}
      {!isOnline && (
        <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full alert-warning w-fit">
          <WifiOff className="w-3 h-3" /> Hors ligne
        </div>
      )}
      {renderStep()}
    </div>
  );
}
