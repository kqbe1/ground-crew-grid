import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Send, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateFichePdf, PdfConfig } from "@/lib/generateFichePdf";
import { loadPdfConfigAndLogo, ficheDocumentType } from "@/lib/pdfConfig";
import { sendFicheToAG } from "@/lib/sendEmailAG";

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

  const clientEmail = sheet?.work_tasks?.clients?.email;

  useEffect(() => {
    if (!open || !sheet) return;
    (async () => {
      setLoading(true);
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
        sheet,
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
    if (!clientEmail) {
      toast.error("Ce client n'a pas d'adresse email");
      return;
    }
    setSending(true);
    try {
      await sendFicheToAG(sheet, values as Partial<PdfConfig>);
      toast.success(`Fiche envoyée à ${clientEmail}`);
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer la fiche au client</DialogTitle>
          <DialogDescription>
            {clientEmail ? `Destinataire : ${clientEmail}` : "Ce client n'a pas d'adresse email"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
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
          <Button onClick={send} disabled={sending || loading || !clientEmail}>
            {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            {sending ? "Envoi..." : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
