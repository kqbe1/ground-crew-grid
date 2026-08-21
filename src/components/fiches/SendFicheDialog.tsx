import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateFichePdf, PdfConfig } from "@/lib/generateFichePdf";
import { loadPdfConfigAndLogo, ficheDocumentType, withPdfPhotos } from "@/lib/pdfConfig";
import { sendFicheToAG, resolveFicheEmail } from "@/lib/sendEmailAG";

type FieldKey =
  | "show_intervention_type"
  | "show_client_info"
  | "show_worker_info"
  | "show_horaires"
  | "show_description"
  | "show_checklist"
  | "show_client_state"
  | "show_photos_before"
  | "show_photos_after"
  | "show_signature";

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "show_intervention_type", label: "Type d'intervention" },
  { key: "show_client_info", label: "Coordonnées client" },
  { key: "show_worker_info", label: "Technicien" },
  { key: "show_horaires", label: "Horaires (arrivée / départ)" },
  { key: "show_description", label: "Description des travaux" },
  { key: "show_checklist", label: "Checklist" },
  { key: "show_client_state", label: "État / statut de l'intervention" },
  { key: "show_photos_before", label: "Photos avant" },
  { key: "show_photos_after", label: "Photos après" },
  { key: "show_signature", label: "Signature client" },
];

interface Props {
  sheet: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

export default function SendFicheDialog({ sheet, open, onOpenChange, onSent }: Props) {
  const [values, setValues] = useState<Record<FieldKey, boolean>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, true])) as Record<FieldKey, boolean>,
  );
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const emailRef = useRef<HTMLInputElement>(null);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim());

  // Android/Capacitor: keep the focused email field visible above the soft keyboard.
  // Scoped to this dialog only — listener is attached on focus and removed on blur.
  const keepEmailVisible = () => {
    emailRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const handleEmailFocus = () => {
    // Initial nudge once the keyboard animation starts
    setTimeout(keepEmailVisible, 250);
    window.visualViewport?.addEventListener("resize", keepEmailVisible);
  };

  const handleEmailBlur = () => {
    window.visualViewport?.removeEventListener("resize", keepEmailVisible);
  };

  useEffect(() => {
    return () => window.visualViewport?.removeEventListener("resize", keepEmailVisible);
  }, []);

  useEffect(() => {
    if (!open || !sheet) return;
    (async () => {
      setLoading(true);
      setRecipient(resolveFicheEmail(sheet));
      const { pdfCfg } = await loadPdfConfigAndLogo(ficheDocumentType(sheet));
      const next = { ...values };
      FIELDS.forEach((f) => {
        const v = (pdfCfg as any)?.[f.key];
        next[f.key] = v === undefined || v === null ? true : !!v;
      });
      setValues(next);
      const { data } = await supabase
        .from("email_settings")
        .select("subject")
        .eq("template_key", "fiche-intervention")
        .maybeSingle();
      setEmailSubject(data?.subject || "Votre fiche d'intervention");
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sheet?.id]);

  const preview = async () => {
    setPreviewing(true);
    try {
      const { pdfCfg, logoDataUrl } = await loadPdfConfigAndLogo(ficheDocumentType(sheet));
      const doc = generateFichePdf(
        await withPdfPhotos(sheet),
        { ...((pdfCfg as Partial<PdfConfig>) || {}), ...values },
        logoDataUrl,
      );
      window.open(URL.createObjectURL(doc.output("blob")), "_blank");
    } catch {
      toast.error("Erreur lors de la génération de l'aperçu");
    } finally {
      setPreviewing(false);
    }
  };

  const send = async () => {
    if (!isValidEmail) {
      toast.error("Adresse email invalide");
      return;
    }
    setSending(true);
    try {
      await sendFicheToAG(sheet, values as Partial<PdfConfig>, recipient.trim());
      toast.success(`Fiche envoyée à ${recipient.trim()}`);
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const allOn = FIELDS.every((f) => values[f.key]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>Envoyer la fiche au client</DialogTitle>
          <DialogDescription>Vérifiez l'adresse du destinataire avant l'envoi.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="fiche-recipient" className="text-sm font-medium">
                Email du destinataire
              </Label>
              <Input
                id="fiche-recipient"
                ref={emailRef}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                onFocus={handleEmailFocus}
                onBlur={handleEmailBlur}
                placeholder="client@exemple.be"
              />
              {!isValidEmail && (
                <p className="text-xs text-destructive">
                  Aucune adresse valide enregistrée pour ce client — saisissez-la ici.
                </p>
              )}
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Contenu de l'email : modèle « Fiche d'intervention » configuré dans Admin › Emails clients.
              <div className="mt-1 text-foreground">Objet : {emailSubject}</div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Champs inclus dans le PDF</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setValues(
                    Object.fromEntries(FIELDS.map((f) => [f.key, !allOn])) as Record<FieldKey, boolean>,
                  )
                }
              >
                {allOn ? "Tout décocher" : "Tout cocher"}
              </Button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <Checkbox
                    id={f.key}
                    checked={values[f.key]}
                    onCheckedChange={(v) => setValues({ ...values, [f.key]: !!v })}
                  />
                  <Label htmlFor={f.key} className="text-sm font-normal cursor-pointer">
                    {f.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Valeurs pré-remplies depuis Admin › Config PDF. Les décocher n'affecte que cet envoi.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={preview} disabled={previewing || loading}>
            {previewing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
            Aperçu
          </Button>
          <Button onClick={send} disabled={sending || loading || !isValidEmail}>
            {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            {sending ? "Envoi..." : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
