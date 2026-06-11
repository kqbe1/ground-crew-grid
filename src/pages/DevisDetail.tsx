import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS, INSTALLATION_TYPE_LABELS } from "@/lib/constants";
import { invalidateQuotesCache } from "@/lib/quotesQuery";
import { Download, MessageSquare, Send, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import LayoutDetail from "@/components/layout/LayoutDetail";
import { PhotoGrid } from "@/components/ui/photo-lightbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { downloadDevisPdf } from "@/lib/generateDevisPdf";
import { loadPdfConfigAndLogo } from "@/lib/pdfConfig";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const statuses = ["en_attente"] as const;

export default function DevisDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [pdfSettings, setPdfSettings] = useState<any>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fetchQuote = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("quotes").select("*, profiles!quotes_created_by_fkey(full_name)").eq("id", id).single();
    setQuote(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  useEffect(() => {
    if (!quote) return;
    (async () => {
      const { pdfCfg, logoDataUrl: logo } = await loadPdfConfigAndLogo("devis");
      setPdfSettings(pdfCfg);
      setLogoDataUrl(logo);
    })();
  }, [quote]);

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("quotes").update({ status } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidateQuotesCache();
    toast.success(`Statut → ${QUOTE_STATUS_LABELS[status]}`);
    fetchQuote();
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("quotes").delete().eq("id", id!);
    if (error) { toast.error(error.message); return; }
    invalidateQuotesCache();
    toast.success("Devis supprimé");
    navigate(-1);
  };

  const addComment = async () => {
    if (!newComment.trim() || !quote) return;
    const comments = [...(quote.internal_comments || []), { text: newComment.trim(), date: new Date().toISOString() }];
    const { error } = await supabase.from("quotes").update({ internal_comments: comments } as any).eq("id", id!);
    if (error) { toast.error(error.message); return; }
    invalidateQuotesCache();
    toast.success("Commentaire ajouté");
    setNewComment("");
    fetchQuote();
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      downloadDevisPdf(quote, pdfSettings ? {
        company_name: pdfSettings.company_name, company_address: pdfSettings.company_address,
        company_phone: pdfSettings.company_phone, company_email: pdfSettings.company_email,
        company_website: pdfSettings.company_website, company_vat: pdfSettings.company_vat,
        primary_color: pdfSettings.primary_color, footer_text: pdfSettings.footer_text,
        document_title: pdfSettings.document_title, text_blocks: pdfSettings.text_blocks,
      } : undefined, logoDataUrl);
      toast.success("PDF téléchargé");
    } catch { toast.error("Erreur PDF"); } finally { setDownloading(false); }
  };

  if (loading) return <LayoutDetail loading resourceLabel="Devis">{null}</LayoutDetail>;
  if (!quote) return <LayoutDetail notFound resourceLabel="Devis">{null}</LayoutDetail>;

  const rooms = Array.isArray(quote.rooms_data) ? quote.rooms_data : [];
  const photos = Array.isArray(quote.photos) ? quote.photos : [];
  const planPhotos = Array.isArray(quote.plan_photos) ? quote.plan_photos : [];
  const voiceNotes = Array.isArray(quote.voice_notes) ? quote.voice_notes : [];
  const comments = Array.isArray(quote.internal_comments) ? quote.internal_comments : [];

  return (
    <LayoutDetail
      icon={<Badge className="bg-[hsl(var(--color-devis))] text-white">+FD</Badge>}
      title={quote.client_name}
      subtitle={`${INSTALLATION_TYPE_LABELS[quote.installation_type]} · ${quote.profiles?.full_name ?? ""} · ${format(new Date(quote.created_at), "d MMMM yyyy HH:mm", { locale: fr })}`}
      actions={
        <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloading}>
          <Download className="w-4 h-4 mr-1" /> Télécharger
        </Button>
      }
      toolbar={
        <>
          {statuses.map((s) => (
            <Button key={s} size="sm" variant={quote.status === s ? "default" : "outline"} className={quote.status === s ? `${QUOTE_STATUS_COLORS[s]} text-white` : ""} onClick={() => updateStatus(s)}>
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive"><Trash2 className="w-4 h-4 mr-1" /> Supprimer</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      }
    >
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

      {/* Urgency & description */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {quote.is_urgent && <Badge className="bg-destructive text-destructive-foreground">🔴 Urgent</Badge>}
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
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Pièces ({rooms.length})</h2>
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
        </section>
      )}

      {/* Checklist */}
      {quote.checklist_data && Object.keys(quote.checklist_data).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Checklist</h2>
          <div className="space-y-1">
            {Object.entries(quote.checklist_data).map(([item, checked]) => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <span>{checked ? "✅" : "⬜"}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Photos & Plans */}
      <PhotoGrid photos={planPhotos} label="Plans" />
      <PhotoGrid photos={photos} label="Photos" />

      {/* Voice notes */}
      {voiceNotes.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Notes vocales ({voiceNotes.length})</h2>
          <div className="space-y-2">
            {voiceNotes.map((url: string, i: number) => (
              <audio key={i} controls className="w-full" src={url}>
                Votre navigateur ne supporte pas l'audio.
              </audio>
            ))}
          </div>
        </section>
      )}

      {/* Internal comments */}
      <section className="space-y-3 border-t pt-4">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Achats & Commentaires
        </h2>
        {comments.map((c: any, i: number) => (
          <div key={i} className="p-3 rounded-lg bg-muted text-sm">
            <p>{c.text}</p>
            <p className="text-xs text-muted-foreground mt-1">{format(new Date(c.date), "d MMM yyyy HH:mm", { locale: fr })}</p>
          </div>
        ))}
        <div className="flex gap-2">
          <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Ajouter un commentaire..." className="flex-1" rows={2} />
          <Button size="sm" onClick={addComment} disabled={!newComment.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </section>
    </LayoutDetail>
  );
}
