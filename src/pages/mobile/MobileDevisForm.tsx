import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEVIS_CHECKLISTS, INSTALLATION_TYPE_LABELS } from "@/lib/constants";
import { ArrowLeft, ArrowRight, X, Plus, Camera, Image, Mic, Trash2, Wrench, Snowflake, Wind, Droplets, Settings, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 8;

const ROOM_TYPES = ["Salon", "Chambre", "Cuisine", "Salle de bain", "Bureau", "Couloir", "Garage", "Cave", "Grenier", "Autre"];

const INSULATION_COEFFICIENTS: Record<string, number> = { good: 30, average: 40, bad: 50 };

interface Room {
  type: string;
  length: string;
  width: string;
  height: string;
  insulation: "good" | "average" | "bad";
  remark: string;
}

const INSTALL_ICONS: Record<string, any> = {
  chaudiere: Wrench,
  climatisation: Snowflake,
  vmc: Wind,
  salle_de_bain: Droplets,
  autre: Settings,
};

export default function MobileDevisForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  // Step 1
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPostal, setClientPostal] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [billingSame, setBillingSame] = useState(true);
  const [billingAddress, setBillingAddress] = useState("");
  const [billingPostal, setBillingPostal] = useState("");
  const [billingCity, setBillingCity] = useState("");

  // Step 2
  const [installationType, setInstallationType] = useState("");

  // Step 3
  const [rooms, setRooms] = useState<Room[]>([{ type: "Salon", length: "", width: "", height: "", insulation: "average", remark: "" }]);
  const [planPhotos, setPlanPhotos] = useState<File[]>([]);

  // Step 4
  const [isUrgent, setIsUrgent] = useState(false);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [completeExisting, setCompleteExisting] = useState(false);
  const [workDescription, setWorkDescription] = useState("");

  // Step 5
  const [checklistData, setChecklistData] = useState<Record<string, boolean>>({});

  // Step 6
  const [photos, setPhotos] = useState<File[]>([]);

  // Step 7
  const [voiceNotes, setVoiceNotes] = useState<{ blob: Blob; url: string }[]>([]);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const planFileRef = useRef<HTMLInputElement>(null);
  const planCameraRef = useRef<HTMLInputElement>(null);

  const calcWattage = (room: Room) => {
    const l = parseFloat(room.length) || 0;
    const w = parseFloat(room.width) || 0;
    const h = parseFloat(room.height) || 0;
    if (l === 0 || w === 0 || h === 0) return null;
    return Math.round(l * w * h * INSULATION_COEFFICIENTS[room.insulation]);
  };

  const updateRoom = (index: number, field: keyof Room, value: string) => {
    setRooms((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const addRoom = () => {
    setRooms((prev) => [...prev, { type: "Salon", length: "", width: "", height: "", insulation: "average", remark: "" }]);
  };

  const removeRoom = (index: number) => {
    if (rooms.length <= 1) return;
    setRooms((prev) => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setVoiceNotes((prev) => [...prev, { blob, url }]);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Impossible d'accéder au microphone");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const uploadFile = async (file: File | Blob, folder: string, ext: string) => {
    const path = `${user!.id}/${folder}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("quote-assets").upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("quote-assets").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Upload photos
      const photoUrls = await Promise.all(photos.map((f) => uploadFile(f, "photos", f.name.split(".").pop() || "jpg")));
      const planUrls = await Promise.all(planPhotos.map((f) => uploadFile(f, "plans", f.name.split(".").pop() || "jpg")));
      const voiceUrls = await Promise.all(voiceNotes.map((v) => uploadFile(v.blob, "voice", "webm")));

      const roomsData = rooms.map((r) => ({
        ...r,
        wattage: calcWattage(r),
      }));

      const { error } = await supabase.from("quotes").insert({
        created_by: user!.id,
        client_name: clientName,
        client_address: clientAddress,
        client_postal_code: clientPostal,
        client_city: clientCity,
        client_phone: clientPhone,
        client_email: clientEmail,
        billing_same_as_intervention: billingSame,
        billing_address: billingSame ? null : billingAddress,
        billing_postal_code: billingSame ? null : billingPostal,
        billing_city: billingSame ? null : billingCity,
        installation_type: installationType,
        rooms_data: roomsData,
        plan_photos: planUrls,
        is_urgent: isUrgent,
        existing_installation_remove: removeExisting,
        existing_installation_complete: completeExisting,
        work_description: workDescription,
        checklist_data: checklistData,
        photos: photoUrls,
        voice_notes: voiceUrls,
      } as any);

      if (error) throw error;
      toast.success("Devis envoyé !");
      navigate(-1);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 1) return clientName.trim() && clientEmail.trim();
    if (step === 2) return !!installationType;
    return true;
  };

  const handleClose = () => navigate(-1);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          {step > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Retour
            </Button>
          ) : <div />}
          <Button variant="ghost" size="icon" onClick={handleClose} className="text-destructive">
            <X className="w-5 h-5" />
          </Button>
        </div>
        <Progress value={(step / TOTAL_STEPS) * 100} className="h-2" />
        {step < TOTAL_STEPS && (
          <div className="flex justify-end mt-2">
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Suivant <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 space-y-4 pb-8">
        {/* STEP 1: Coordonnées */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Coordonnées intervention</h2>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Lieu d'intervention</h3>
              <Input placeholder="Nom et prénom *" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              <Input placeholder="Adresse complète" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Code postal" value={clientPostal} onChange={(e) => setClientPostal(e.target.value)} />
                <Input placeholder="Ville" value={clientCity} onChange={(e) => setClientCity(e.target.value)} />
              </div>
              <Input placeholder="Téléphone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} type="tel" />
              <Input placeholder="Email facturation *" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Facturation</h3>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={billingSame} onCheckedChange={(c) => setBillingSame(!!c)} />
                Facturation identique aux coordonnées d'intervention
              </label>
              {!billingSame && (
                <div className="space-y-2 pl-6">
                  <Input placeholder="Adresse facturation" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Code postal" value={billingPostal} onChange={(e) => setBillingPostal(e.target.value)} />
                    <Input placeholder="Ville" value={billingCity} onChange={(e) => setBillingCity(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Type d'installation */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Type d'installation</h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(INSTALLATION_TYPE_LABELS).map(([key, label]) => {
                const Icon = INSTALL_ICONS[key];
                const isSelected = installationType === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setInstallationType(key);
                      // Reset checklist when type changes
                      const items = DEVIS_CHECKLISTS[key] || [];
                      const newChecklist: Record<string, boolean> = {};
                      items.forEach((item) => { newChecklist[item] = false; });
                      setChecklistData(newChecklist);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      isSelected ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    {isSelected && <Check className="w-4 h-4 text-primary absolute top-2 right-2" />}
                    <Icon className={cn("w-8 h-8", isSelected ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-medium", isSelected ? "text-primary" : "")}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Dimensions */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Dimensions des pièces</h2>
            {rooms.map((room, i) => (
              <div key={i} className="p-4 rounded-xl border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Pièce {i + 1}</span>
                  {rooms.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRoom(i)}>
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <Select value={room.type} onValueChange={(v) => updateRoom(i, "type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="L (m)" value={room.length} onChange={(e) => updateRoom(i, "length", e.target.value)} inputMode="decimal" />
                  <Input placeholder="l (m)" value={room.width} onChange={(e) => updateRoom(i, "width", e.target.value)} inputMode="decimal" />
                  <Input placeholder="H (m)" value={room.height} onChange={(e) => updateRoom(i, "height", e.target.value)} inputMode="decimal" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Isolation</span>
                  <div className="flex gap-2">
                    {[
                      { key: "good", label: "Bonne", color: "bg-[hsl(var(--color-termine))]" },
                      { key: "average", label: "Moyenne", color: "bg-[hsl(var(--color-replanifier))]" },
                      { key: "bad", label: "Mauvaise", color: "bg-destructive" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => updateRoom(i, "insulation", opt.key)}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                          room.insulation === opt.key ? `${opt.color} text-white` : "bg-muted text-muted-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {calcWattage(room) && (
                    <div className="text-xs text-primary font-medium text-right">{calcWattage(room)} W</div>
                  )}
                </div>
                <Textarea placeholder="Remarque (optionnel)" value={room.remark} onChange={(e) => updateRoom(i, "remark", e.target.value)} rows={2} />
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={addRoom}>
              <Plus className="w-4 h-4 mr-1" /> Ajouter une pièce
            </Button>

            <div className="space-y-2 pt-4 border-t">
              <h3 className="text-sm font-semibold">Plans de l'installation</h3>
              <p className="text-xs text-muted-foreground">Photographiez un plan manuscrit</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => planFileRef.current?.click()}>
                  <Image className="w-4 h-4 mr-1" /> Galerie
                </Button>
                <Button variant="outline" size="sm" onClick={() => planCameraRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-1" /> Photo
                </Button>
              </div>
              <input ref={planFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPlanPhotos((p) => [...p, ...Array.from(e.target.files || [])])} />
              <input ref={planCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && setPlanPhotos((p) => [...p, e.target.files![0]])} />
              <div className="grid grid-cols-3 gap-2">
                {planPhotos.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} className="w-full aspect-square object-cover rounded-lg" />
                    <button onClick={() => setPlanPhotos((p) => p.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-destructive text-white rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Urgence & Description */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Urgence & Description</h2>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Priorité</h3>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isUrgent} onCheckedChange={(c) => setIsUrgent(!!c)} />
                <span className="flex items-center gap-1">🔴 Demande urgente</span>
              </label>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Installation existante</h3>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={removeExisting} onCheckedChange={(c) => setRemoveExisting(!!c)} />
                Installation existante à retirer
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={completeExisting} onCheckedChange={(c) => setCompleteExisting(!!c)} />
                Installation existante à compléter
              </label>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Description des travaux</h3>
              <Textarea
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Décrivez les travaux à réaliser..."
                rows={5}
              />
            </div>
          </div>
        )}

        {/* STEP 5: Checklist */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Checklist</h2>
            <p className="text-sm text-muted-foreground">
              Checklist pour : <span className="font-medium text-foreground">{INSTALLATION_TYPE_LABELS[installationType] || "—"}</span>
            </p>
            <div className="space-y-2">
              {(DEVIS_CHECKLISTS[installationType] || []).map((item) => (
                <label key={item} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 text-sm">
                  <Checkbox
                    checked={!!checklistData[item]}
                    onCheckedChange={(c) => setChecklistData((prev) => ({ ...prev, [item]: !!c }))}
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* STEP 6: Photos */}
        {step === 6 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Photos</h2>
            <p className="text-sm text-muted-foreground">
              Prenez des photos des pièces, de l'installation existante ou de tout élément pertinent.
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="w-4 h-4 mr-1" /> Photo
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                <Image className="w-4 h-4 mr-1" /> Galerie
              </Button>
            </div>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && setPhotos((p) => [...p, e.target.files![0]])} />
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotos((p) => [...p, ...Array.from(e.target.files || [])])} />
            <div className="grid grid-cols-3 gap-2">
              {photos.map((f, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(f)} className="w-full aspect-square object-cover rounded-lg" />
                  <button onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-destructive text-white rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 7: Notes vocales */}
        {step === 7 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Notes vocales</h2>
            <p className="text-sm text-muted-foreground">
              Enregistrez une ou plusieurs notes vocales. Les fichiers seront joints au PDF.
            </p>
            <div className="flex justify-center">
              <button
                onClick={recording ? stopRecording : startRecording}
                className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center transition-all",
                  recording ? "bg-destructive animate-pulse" : "bg-primary"
                )}
              >
                <Mic className="w-8 h-8 text-white" />
              </button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {recording ? "Enregistrement en cours... Appuyez pour arrêter" : "Appuyez pour enregistrer"}
            </p>
            <div className="space-y-2">
              {voiceNotes.map((vn, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
                  <audio controls className="flex-1 h-10" src={vn.url} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVoiceNotes((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 8: Finalisation */}
        {step === 8 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold">Finalisation</h2>
            <div className="p-6 rounded-xl border text-center space-y-4">
              <p className="font-medium">Les informations sont-elles suffisantes ?</p>
              <div className="flex flex-col gap-3">
                <Button
                  className="bg-[hsl(var(--color-termine))] hover:bg-[hsl(var(--color-termine))]/90 text-white"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Envoi..." : "✓ Oui, envoyer"}
                </Button>
                <Button variant="outline" onClick={() => setStep(7)}>
                  + Ajouter des infos
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
