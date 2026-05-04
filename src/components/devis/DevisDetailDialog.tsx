import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS, INSTALLATION_TYPE_LABELS } from "@/lib/constants";
import { ArrowLeft, Download, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { downloadDevisPdf } from "@/lib/generateDevisPdf";

interface Props {
  quote: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const statuses = ["en_attente", "dossier_en_cours", "en_commande", "sav"] as const;

export default function DevisDetailDialog({ quote, open, onOpenChange, onUpdated }: Props) {
  const [newComment, setNewComment] = useState("");
  const [pdfSettings, setPdfSettings] = useState<any>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.user.id).single();
      if (!profile?.company_id) return;
      const { data: settings } = await supabase.from("pdf_settings").select("*").eq("company_id", profile.company_id).maybeSingle();
      setPdfSettings(settings);
      if (settings?.logo_url) {
        try {
          const resp = await fetch(settings.logo_url);
          const blob = await resp.blob();
          const reader = new FileReader();
          reader.onload = () => setLogoDataUrl(reader.result as string);
          reader.readAsDataURL(blob);
        } catch { /* skip */ }
      }
    })();
  }, [open]);

  if (!quote) return null;

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("quotes").update({ status } as any).eq("id", quote.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Statut → ${QUOTE_STATUS_LABELS[status]}`);
    onUpdated();
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    const comments = [...(quote.internal_comments || []), {
      text: newComment.trim(),
      date: new Date().toISOString(),
    }];
    const { error } = await supabase.from("quotes").update({ internal_comments: comments } as any).eq("id", quote.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Commentaire ajouté");
    setNewComment("");
    onUpdated();
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      downloadDevisPdf(
        quote,
        pdfSettings ? {
          company_name: pdfSettings.company_name,
          company_address: pdfSettings.company_address,
          company_phone: pdfSettings.company_phone,
          company_email: pdfSettings.company_email,
          company_website: pdfSettings.company_website,
          company_vat: pdfSettings.company_vat,
          primary_color: pdfSettings.primary_color,
          footer_text: pdfSettings.footer_text,
        } : undefined,
        logoDataUrl
      );
      toast.success("PDF téléchargé");
    } catch (err) {
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setDownloading(false);
    }
  };

  const rooms = Array.isArray(quote.rooms_data) ? quote.rooms_data : [];
  const photos = Array.isArray(quote.photos) ? quote.photos : [];
  const planPhotos = Array.isArray(quote.plan_photos) ? quote.plan_photos : [];
  const voiceNotes = Array.isArray(quote.voice_notes) ? quote.voice_notes : [];
  const comments = Array.isArray(quote.internal_comments) ? quote.internal_comments : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                <Badge className="bg-rose-500 text-white">+FD</Badge>
                {quote.client_name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {INSTALLATION_TYPE_LABELS[quote.installation_type]} · {format(new Date(quote.created_at), "d MMMM yyyy HH:mm", { locale: fr })}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloading}>
              <Download className="w-4 h-4 mr-1" />
              PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Status buttons */}
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={quote.status === s ? "default" : "outline"}
              className={quote.status === s ? `${QUOTE_STATUS_COLORS[s]} text-white` : ""}
              onClick={() => updateStatus(s)}
            >
              {QUOTE_STATUS_LABELS[s]}
            </Button>
          ))}
          {quote.status === "cloture" ? (
            <Button size="sm" className={`${QUOTE_STATUS_COLORS.cloture} text-white`} disabled>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Clôturé
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className={`${QUOTE_STATUS_COLORS.cloture} text-white hover:opacity-90`}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Clôturer le devis
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clôturer ce devis ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Le devis sera retiré du dashboard et restera consultable dans l'onglet Devis.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => updateStatus("cloture")}>Clôturer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Client info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 p-4 rounded-lg border">
            <h3 className="font-semibold text-sm">Coordonnées client</h3>
            <p className="text-sm">{quote.client_name}</p>
            {quote.client_address && <p className="text-sm text-muted-foreground">{quote.client_address}</p>}
            <p className="text-sm text-muted-foreground">{quote.client_postal_code} {quote.client_city}</p>
            {quote.client_phone && <p className="text-sm text-muted-foreground">📞 {quote.client_phone}</p>}
            {quote.client_email && <p className="text-sm text-muted-foreground">✉️ {quote.client_email}</p>}
          </div>
          {!quote.billing_same_as_intervention && (
            <div className="space-y-2 p-4 rounded-lg border">
              <h3 className="font-semibold text-sm">Facturation</h3>
              {quote.billing_address && <p className="text-sm text-muted-foreground">{quote.billing_address}</p>}
              <p className="text-sm text-muted-foreground">{quote.billing_postal_code} {quote.billing_city}</p>
            </div>
          )}
        </div>

        {/* Urgency & Description */}
        <div className="space-y-2">
          <div className="flex gap-2">
            {quote.is_urgent && <Badge className="bg-red-500 text-white">🔴 Urgent</Badge>}
            {quote.existing_installation_remove && <Badge variant="outline">Installation à retirer</Badge>}
            {quote.existing_installation_complete && <Badge variant="outline">Installation à compléter</Badge>}
          </div>
          {quote.work_description && (
            <div className="p-4 rounded-lg border">
              <h3 className="font-semibold text-sm mb-1">Description des travaux</h3>
              <p className="text-sm whitespace-pre-wrap">{quote.work_description}</p>
            </div>
          )}
        </div>

        {/* Rooms */}
        {rooms.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Pièces ({rooms.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {rooms.map((room: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border text-sm space-y-1">
                  <div className="font-medium">{room.type || `Pièce ${i + 1}`}</div>
                  <div className="text-muted-foreground">
                    {room.length}m × {room.width}m × {room.height}m
                    {room.wattage && <span className="ml-2 font-medium text-primary">{room.wattage} W</span>}
                  </div>
                  <div className="text-xs">Isolation: {room.insulation === "good" ? "🟢 Bonne" : room.insulation === "average" ? "🟠 Moyenne" : "🔴 Mauvaise"}</div>
                  {room.remark && <div className="text-xs text-muted-foreground">{room.remark}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Checklist */}
        {quote.checklist_data && Object.keys(quote.checklist_data).length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Checklist</h3>
            <div className="space-y-1">
              {Object.entries(quote.checklist_data).map(([item, checked]) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <span>{checked ? "✅" : "⬜"}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        {(photos.length > 0 || planPhotos.length > 0) && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Photos & Plans</h3>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {[...planPhotos, ...photos].map((url: string, i: number) => (
                <img key={i} src={url} alt={`Photo ${i + 1}`} className="rounded-lg w-full aspect-square object-cover" />
              ))}
            </div>
          </div>
        )}

        {/* Voice notes */}
        {voiceNotes.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Notes vocales ({voiceNotes.length})</h3>
            <div className="space-y-2">
              {voiceNotes.map((url: string, i: number) => (
                <audio key={i} controls className="w-full" src={url}>
                  Votre navigateur ne supporte pas l'audio.
                </audio>
              ))}
            </div>
          </div>
        )}

        {/* Internal comments */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Achats & Commentaires
          </h3>
          {comments.map((c: any, i: number) => (
            <div key={i} className="p-3 rounded-lg bg-muted text-sm">
              <p>{c.text}</p>
              <p className="text-xs text-muted-foreground mt-1">{format(new Date(c.date), "d MMM yyyy HH:mm", { locale: fr })}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ajouter un commentaire..."
              className="flex-1"
              rows={2}
            />
            <Button size="sm" onClick={addComment} disabled={!newComment.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
