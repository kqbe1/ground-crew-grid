import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TASK_STATUS_LABELS, INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileSignature, Camera, Clock, Mail, Check, User, AlertTriangle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { downloadFichePdf, PdfConfig } from "@/lib/generateFichePdf";

interface FicheDetailDialogProps {
  sheet: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export default function FicheDetailDialog({ sheet, open, onOpenChange, onUpdated }: FicheDetailDialogProps) {
  const [sending, setSending] = useState(false);

  if (!sheet) return null;

  const task = sheet.work_tasks;
  const worker = sheet.profiles;

  const statusColor: Record<string, string> = {
    planifie: "bg-[hsl(var(--color-planifie))]",
    termine: "bg-[hsl(var(--color-termine))]",
    a_replanifier: "bg-[hsl(var(--color-replanifier))]",
    piece_a_commander: "bg-[hsl(var(--color-piece))]",
  };

  const handleSendEmail = async () => {
    if (!task?.clients?.email) {
      toast.error("Ce client n'a pas d'adresse email");
      return;
    }
    setSending(true);
    // Mark as sent
    await supabase.from("intervention_sheets").update({ sent_to_client: true }).eq("id", sheet.id);
    toast.success(`Email envoyé à ${task.clients.email}`);
    setSending(false);
    onUpdated();
  };

  const interventionType = task?.intervention_type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl">{task?.title || "Fiche d'intervention"}</DialogTitle>
            {interventionType && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INTERVENTION_TYPE_COLORS[interventionType]}`}>
                {INTERVENTION_TYPE_LABELS[interventionType]}
              </span>
            )}
          </div>
          <DialogDescription>
            {task?.clients?.name} · {worker?.full_name} · {format(new Date(sheet.created_at), "d MMMM yyyy", { locale: fr })}
          </DialogDescription>
        </DialogHeader>

        {/* Status & flags */}
        <div className="flex flex-wrap gap-2 items-center">
          <Badge className={`${statusColor[sheet.final_status]} text-white`}>
            {TASK_STATUS_LABELS[sheet.final_status]}
          </Badge>
          {sheet.is_draft && <Badge variant="outline" className="border-dashed">Brouillon</Badge>}
          {sheet.sent_to_client && (
            <Badge variant="outline" className="text-[hsl(var(--color-termine))] border-[hsl(var(--color-termine))]">
              <Mail className="w-3 h-3 mr-1" /> Envoyé
            </Badge>
          )}
          {sheet.signature_data && (
            <Badge variant="outline" className="text-[hsl(var(--color-termine))] border-[hsl(var(--color-termine))]">
              <FileSignature className="w-3 h-3 mr-1" /> Signé
            </Badge>
          )}
          {sheet.client_absent && (
            <Badge variant="outline" className="text-[hsl(var(--color-replanifier))] border-[hsl(var(--color-replanifier))]">
              <AlertTriangle className="w-3 h-3 mr-1" /> Client absent
            </Badge>
          )}
        </div>

        <Tabs defaultValue="details" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">Détails</TabsTrigger>
            <TabsTrigger value="photos" className="flex-1">
              Photos ({(sheet.photos_before?.length || 0) + (sheet.photos_after?.length || 0)})
            </TabsTrigger>
            <TabsTrigger value="signature" className="flex-1">Signature</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Horaires */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Arrivée</div>
                  <div className="font-medium">
                    {sheet.arrival_time ? format(new Date(sheet.arrival_time), "HH:mm", { locale: fr }) : "—"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Départ</div>
                  <div className="font-medium">
                    {sheet.departure_time ? format(new Date(sheet.departure_time), "HH:mm", { locale: fr }) : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {sheet.description && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Description</div>
                <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{sheet.description}</p>
              </div>
            )}

            {/* Checklist */}
            {sheet.checklist_results && Array.isArray(sheet.checklist_results) && sheet.checklist_results.length > 0 && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Checklist</div>
                <div className="space-y-1">
                  {(sheet.checklist_results as any[]).map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className={`w-4 h-4 ${item.checked ? "text-[hsl(var(--color-termine))]" : "text-muted-foreground"}`} />
                      <span className={item.checked ? "" : "text-muted-foreground"}>{item.label || item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Worker info */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <User className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Ouvrier</div>
                <div className="font-medium">{worker?.full_name || "—"}</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="photos" className="mt-4">
            {sheet.photos_before?.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-medium text-muted-foreground mb-2">Photos avant</div>
                <div className="grid grid-cols-3 gap-2">
                  {sheet.photos_before.map((url: string, i: number) => (
                    <img key={i} src={url} alt={`Avant ${i + 1}`} className="rounded-lg object-cover aspect-square w-full" />
                  ))}
                </div>
              </div>
            )}
            {sheet.photos_after?.length > 0 && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Photos après</div>
                <div className="grid grid-cols-3 gap-2">
                  {sheet.photos_after.map((url: string, i: number) => (
                    <img key={i} src={url} alt={`Après ${i + 1}`} className="rounded-lg object-cover aspect-square w-full" />
                  ))}
                </div>
              </div>
            )}
            {(!sheet.photos_before?.length && !sheet.photos_after?.length) && (
              <div className="py-8 text-center text-muted-foreground">
                <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Aucune photo
              </div>
            )}
          </TabsContent>

          <TabsContent value="signature" className="mt-4">
            {sheet.signature_data ? (
              <div className="text-center">
                <img src={sheet.signature_data} alt="Signature client" className="mx-auto max-h-48 border rounded-lg p-4 bg-white" />
                {sheet.signed_at && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Signé le {format(new Date(sheet.signed_at), "d MMMM yyyy à HH:mm", { locale: fr })}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <FileSignature className="w-8 h-8 mx-auto mb-2 opacity-50" />
                {sheet.client_absent ? "Client absent — pas de signature" : "Pas encore signé"}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            onClick={async () => {
              const { data: pdfCfg } = await supabase.from("pdf_settings").select("*").limit(1).single();
              let logoDataUrl: string | null = null;
              if (pdfCfg?.logo_url) {
                try {
                  const { data: signedData } = await supabase.storage
                    .from("intervention-photos")
                    .createSignedUrl(pdfCfg.logo_url, 60);
                  if (signedData?.signedUrl) {
                    const resp = await fetch(signedData.signedUrl);
                    const blob = await resp.blob();
                    logoDataUrl = await new Promise<string>((res) => {
                      const r = new FileReader();
                      r.onloadend = () => res(r.result as string);
                      r.readAsDataURL(blob);
                    });
                  }
                } catch {}
              }
              downloadFichePdf(sheet, pdfCfg as Partial<PdfConfig> | undefined, logoDataUrl);
            }}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-1" />
            Télécharger PDF
          </Button>
          {!sheet.sent_to_client && (
            <Button onClick={handleSendEmail} disabled={sending} size="sm">
              <Mail className="w-4 h-4 mr-1" />
              {sending ? "Envoi..." : "Envoyer au client"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
