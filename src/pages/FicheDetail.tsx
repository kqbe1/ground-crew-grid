import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { TASK_STATUS_LABELS, INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileSignature, Camera, Clock, Mail, Check, User, AlertTriangle, Download, ArrowLeft, Loader2, Trash2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { generateFichePdf, downloadFichePdf, PdfConfig } from "@/lib/generateFichePdf";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const statusColor: Record<string, string> = {
  planifie: "bg-[hsl(var(--color-planifie))]",
  termine: "bg-[hsl(var(--color-termine))]",
  a_replanifier: "bg-[hsl(var(--color-replanifier))]",
  piece_a_commander: "bg-[hsl(var(--color-piece))]",
  sav: "bg-[hsl(var(--color-sav))]",
};

const ALL_STATUSES = ["termine", "a_replanifier", "piece_a_commander", "sav", "planifie"] as const;

export default function FicheDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");

  const fetchSheet = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("intervention_sheets")
      .select("*, work_tasks(title, intervention_type, clients(name, email, phone, address_intervention), client_sites(address)), profiles!intervention_sheets_worker_id_fkey(full_name)")
      .eq("id", id)
      .single();
    setSheet(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchSheet(); }, [fetchSheet]);

  const loadPdfConfig = useCallback(async () => {
    const { data: pdfCfg } = await supabase.from("pdf_settings").select("*").limit(1).single();
    let logoDataUrl: string | null = null;
    if (pdfCfg?.logo_url) {
      try {
        const { data: signedData } = await supabase.storage.from("intervention-photos").createSignedUrl(pdfCfg.logo_url, 60);
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
    return { pdfCfg, logoDataUrl };
  }, []);

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("intervention_sheets").update({ final_status: status } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Statut → ${TASK_STATUS_LABELS[status]}`);
    fetchSheet();
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("intervention_sheets").delete().eq("id", id!);
    if (error) { toast.error(error.message); return; }
    toast.success("Fiche supprimée");
    navigate(-1);
  };

  const addComment = async () => {
    if (!newComment.trim() || !sheet) return;
    const existing = sheet.internal_comment ? sheet.internal_comment + "\n---\n" : "";
    const comment = existing + `[${format(new Date(), "dd/MM/yyyy HH:mm")}] ${newComment.trim()}`;
    const { error } = await supabase.from("intervention_sheets").update({ internal_comment: comment }).eq("id", id!);
    if (error) { toast.error(error.message); return; }
    toast.success("Commentaire ajouté");
    setNewComment("");
    fetchSheet();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!sheet) return <div className="p-6 text-center text-muted-foreground">Fiche introuvable</div>;

  const task = sheet.work_tasks;
  const worker = sheet.profiles;
  const interventionType = task?.intervention_type;
  const isEntretien = interventionType?.startsWith("entretien_");
  const badgeType = isEntretien ? "+FE" : "+FI";
  const badgeColor = isEntretien ? "bg-blue-500" : "bg-primary";

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Badge className={`${badgeColor} text-white`}>{badgeType}</Badge>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{task?.title || "Fiche d'intervention"}</h1>
              <p className="text-sm text-muted-foreground">
                {task?.clients?.name} · {worker?.full_name} · {format(new Date(sheet.created_at), "d MMMM yyyy HH:mm", { locale: fr })}
              </p>
            </div>
            {interventionType && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INTERVENTION_TYPE_COLORS[interventionType]} hidden sm:inline`}>
                {INTERVENTION_TYPE_LABELS[interventionType]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={async () => {
              const { pdfCfg, logoDataUrl } = await loadPdfConfig();
              downloadFichePdf(sheet, pdfCfg as Partial<PdfConfig> | undefined, logoDataUrl);
            }}>
              <Download className="w-4 h-4 mr-1" /> Télécharger
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Retour
            </Button>
          </div>
        </div>

        {/* Status buttons */}
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={sheet.final_status === s ? "default" : "outline"}
              className={sheet.final_status === s ? `${statusColor[s]} text-white` : ""}
              onClick={() => updateStatus(s)}
            >
              {TASK_STATUS_LABELS[s]}
            </Button>
          ))}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive"><Trash2 className="w-4 h-4 mr-1" /> Supprimer</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette fiche ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Flags */}
        <div className="flex flex-wrap gap-2">
          {sheet.is_draft && <Badge variant="outline" className="border-dashed">Brouillon</Badge>}
          {sheet.sent_to_client && <Badge variant="outline" className="text-[hsl(var(--color-termine))] border-[hsl(var(--color-termine))]"><Mail className="w-3 h-3 mr-1" /> Envoyé</Badge>}
          {sheet.signature_data && <Badge variant="outline" className="text-[hsl(var(--color-termine))] border-[hsl(var(--color-termine))]"><FileSignature className="w-3 h-3 mr-1" /> Signé</Badge>}
          {sheet.client_absent && <Badge variant="outline" className="text-[hsl(var(--color-replanifier))] border-[hsl(var(--color-replanifier))]"><AlertTriangle className="w-3 h-3 mr-1" /> Client absent</Badge>}
        </div>
      </div>

      <Separator />

      {/* Coordonnées client */}
      <section className="space-y-2">
        <h2 className="font-semibold text-sm">Coordonnées client</h2>
        <div className="p-4 rounded-lg border text-sm space-y-1">
          <p className="font-medium">{task?.clients?.name}</p>
          {task?.clients?.address_intervention && <p className="text-muted-foreground">{task.clients.address_intervention}</p>}
          {sheet.work_tasks?.client_sites?.address && <p className="text-muted-foreground">Site : {sheet.work_tasks.client_sites.address}</p>}
          {task?.clients?.phone && <p className="text-muted-foreground">📞 {task.clients.phone}</p>}
          {task?.clients?.email && <p className="text-muted-foreground">✉️ {task.clients.email}</p>}
          {sheet.client_name_override && <p className="text-muted-foreground">Override : {sheet.client_name_override}</p>}
        </div>
      </section>

      {/* Photos avant */}
      {sheet.photos_before?.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Photos avant travaux</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {sheet.photos_before.map((url: string, i: number) => (
              <img key={i} src={url} alt={`Avant ${i + 1}`} className="rounded-lg object-cover aspect-square w-full" />
            ))}
          </div>
        </section>
      )}

      {/* Plaque signalétique */}
      {(sheet.photos_nameplate?.length > 0 || (sheet.nameplate_data && Object.keys(sheet.nameplate_data).length > 0)) && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Plaque signalétique</h2>
          {sheet.photos_nameplate?.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {sheet.photos_nameplate.map((url: string, i: number) => (
                <img key={i} src={url} alt={`Plaque ${i + 1}`} className="rounded-lg object-cover aspect-square w-full" />
              ))}
            </div>
          )}
          {sheet.nameplate_data && Object.keys(sheet.nameplate_data).length > 0 && (
            <div className="p-3 rounded-lg border text-sm grid grid-cols-2 gap-2">
              {Object.entries(sheet.nameplate_data).map(([key, val]) => (
                <div key={key}>
                  <span className="text-muted-foreground">{key}: </span>
                  <span className="font-medium">{String(val)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Description / Checklist */}
      {sheet.description && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Description du travail</h2>
          <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{sheet.description}</p>
        </section>
      )}

      {sheet.checklist_results && Array.isArray(sheet.checklist_results) && sheet.checklist_results.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Checklist</h2>
          <div className="space-y-1">
            {(sheet.checklist_results as any[]).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Check className={`w-4 h-4 ${item.checked ? "text-[hsl(var(--color-termine))]" : "text-muted-foreground"}`} />
                <span className={item.checked ? "" : "text-muted-foreground"}>{item.label || item.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fournitures */}
      {sheet.supplies_description && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Fournitures utilisées</h2>
          <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{sheet.supplies_description}</p>
        </section>
      )}

      {/* Photos après */}
      {sheet.photos_after?.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Photos après travaux</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {sheet.photos_after.map((url: string, i: number) => (
              <img key={i} src={url} alt={`Après ${i + 1}`} className="rounded-lg object-cover aspect-square w-full" />
            ))}
          </div>
        </section>
      )}

      {/* Horaires */}
      <section className="space-y-2">
        <h2 className="font-semibold text-sm">Horaires et statut</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Arrivée</div>
              <div className="font-medium">{sheet.arrival_time ? format(new Date(sheet.arrival_time), "HH:mm") : "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Départ</div>
              <div className="font-medium">{sheet.departure_time ? format(new Date(sheet.departure_time), "HH:mm") : "—"}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
          <User className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Ouvrier</div>
            <div className="font-medium">{worker?.full_name || "—"}</div>
          </div>
        </div>
        {sheet.work_status_detail && (
          <p className="text-sm text-muted-foreground">Détail statut : {sheet.work_status_detail}</p>
        )}
        {sheet.status_comment && (
          <p className="text-sm text-muted-foreground">Commentaire statut : {sheet.status_comment}</p>
        )}
      </section>

      {/* Signature */}
      <section className="space-y-2">
        <h2 className="font-semibold text-sm">Signature client</h2>
        {sheet.signature_data ? (
          <div className="text-center">
            <img src={sheet.signature_data} alt="Signature client" className="mx-auto max-h-48 border rounded-lg p-4 bg-white" />
            {sheet.signed_at && (
              <p className="text-sm text-muted-foreground mt-2">Signé le {format(new Date(sheet.signed_at), "d MMMM yyyy à HH:mm", { locale: fr })}</p>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            <FileSignature className="w-8 h-8 mx-auto mb-2 opacity-50" />
            {sheet.client_absent ? "Client absent — pas de signature" : "Pas encore signé"}
          </div>
        )}
      </section>

      {/* Commentaires internes */}
      <section className="space-y-3 border-t pt-4">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Achats & Commentaires internes
        </h2>
        {sheet.internal_comment && (
          <div className="p-3 rounded-lg bg-muted text-sm whitespace-pre-wrap">{sheet.internal_comment}</div>
        )}
        <div className="flex gap-2">
          <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Ajouter un commentaire..." className="flex-1" rows={2} />
          <Button size="sm" onClick={addComment} disabled={!newComment.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Internal photos */}
      {sheet.internal_photos?.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Photos internes</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {sheet.internal_photos.map((url: string, i: number) => (
              <img key={i} src={url} alt={`Interne ${i + 1}`} className="rounded-lg object-cover aspect-square w-full" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
