import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { TASK_STATUS_LABELS, INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS, ORDER_STATUS_LABELS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileSignature, Clock, Mail, Check, User, AlertTriangle, Download, Loader2, Trash2, MessageSquare, Send, Wrench, MapPin, Package, ExternalLink } from "lucide-react";
import LayoutDetail from "@/components/layout/LayoutDetail";
import { PhotoGrid } from "@/components/ui/photo-lightbox";
import { toast } from "sonner";
import { generateFichePdf, downloadFichePdf, PdfConfig } from "@/lib/generateFichePdf";
import { loadPdfConfigAndLogo, ficheDocumentType } from "@/lib/pdfConfig";
import { Textarea } from "@/components/ui/textarea";
import { useSignedUrls } from "@/hooks/useSignedUrl";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { SheetStatusBadge, computeSheetStatus } from "@/components/shared/SheetStatusBadge";

const statusColor: Record<string, string> = {
  planifie: "bg-[hsl(var(--color-planifie))]",
  termine: "bg-[hsl(var(--color-termine))]",
  a_replanifier: "bg-[hsl(var(--color-replanifier))]",
  piece_a_commander: "bg-[hsl(var(--color-piece))]",
  sav: "bg-[hsl(var(--color-sav))]",
};

const ALL_STATUSES = ["termine", "a_replanifier", "piece_a_commander", "sav", "planifie"] as const;

const ORDER_STATUSES = ["demandee", "commandee", "recue", "cloturee"] as const;
const orderStatusColors: Record<string, string> = {
  demandee: "bg-order-demandee text-white",
  commandee: "bg-order-commandee text-white",
  recue: "bg-order-recue text-white",
  cloturee: "bg-order-cloturee text-white",
};

const WORK_STATUS_LABELS: Record<string, string> = {
  termine: "Travail terminé",
  piece_a_commander: "Pièce à commander",
  piece_commandee: "Pièce commandée",
  a_refixer: "À refixer pour autre travail",
  sav: "SAV",
  autre: "Autre",
};

export default function FicheDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isReadOnly = role === "ouvrier";
  const [sheet, setSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [orders, setOrders] = useState<any[]>([]);

  const fetchSheet = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("intervention_sheets")
      .select("*, work_tasks(title, intervention_type, scheduled_date, start_time, duration_minutes, clients(name, email, phone, address_intervention), client_sites(name, address)), profiles!intervention_sheets_worker_id_fkey(full_name)")
      .eq("id", id)
      .single();
    setSheet(data);
    setLoading(false);
    if (data?.work_task_id) {
      const { data: po } = await supabase
        .from("parts_orders")
        .select("*, profiles!parts_orders_requested_by_fkey(full_name)")
        .eq("work_task_id", data.work_task_id)
        .order("created_at", { ascending: false });
      setOrders(po ?? []);
    } else {
      setOrders([]);
    }
  }, [id]);

  useEffect(() => { fetchSheet(); }, [fetchSheet]);

  // Re-sign photo URLs
  const photosBefore = useSignedUrls(sheet?.photos_before || []);
  const photosAfter = useSignedUrls(sheet?.photos_after || []);
  const photosNameplate = useSignedUrls(sheet?.photos_nameplate || []);
  const internalPhotos = useSignedUrls(sheet?.internal_photos || []);

  const loadPdfConfig = useCallback(async () => {
    return await loadPdfConfigAndLogo(ficheDocumentType(sheet));
  }, [sheet]);

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("intervention_sheets").update({ final_status: status } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Statut → ${TASK_STATUS_LABELS[status]}`);
    fetchSheet();
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const patch: any = { status };
    if (status === "commandee") patch.ordered_at = new Date().toISOString();
    if (status === "recue") patch.received_at = new Date().toISOString();
    if (status === "cloturee") patch.closed_at = new Date().toISOString();
    const { error } = await supabase.from("parts_orders").update(patch).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Commande → ${ORDER_STATUS_LABELS[status]}`);
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

  if (loading) return <LayoutDetail loading resourceLabel="Fiche">{null}</LayoutDetail>;
  if (!sheet) return <LayoutDetail notFound resourceLabel="Fiche">{null}</LayoutDetail>;

  const task = sheet.work_tasks;
  const worker = sheet.profiles;
  const interventionType = task?.intervention_type;
  const isEntretien = interventionType?.startsWith("entretien_");
  const badgeType = isEntretien ? "+FE" : "+FI";
  const badgeColor = isEntretien ? "bg-[hsl(var(--color-fiche-entretien))]" : "bg-primary";

  return (
    <LayoutDetail
      icon={<Badge className={`${badgeColor} text-white`}>{badgeType}</Badge>}
      title={task?.title || "Fiche d'intervention"}
      subtitle={`${task?.clients?.name ?? ""} · ${worker?.full_name ?? ""} · ${format(new Date(sheet.created_at), "d MMMM yyyy HH:mm", { locale: fr })}`}
      titleAdornment={
        interventionType ? (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INTERVENTION_TYPE_COLORS[interventionType]} hidden sm:inline`}>
            {INTERVENTION_TYPE_LABELS[interventionType]}
          </span>
        ) : null
      }
      actions={
        <Button variant="outline" size="sm" onClick={async () => {
          const { pdfCfg, logoDataUrl } = await loadPdfConfig();
          downloadFichePdf(sheet, pdfCfg as Partial<PdfConfig> | undefined, logoDataUrl);
        }}>
          <Download className="w-4 h-4 mr-1" /> Télécharger
        </Button>
      }
      toolbar={isReadOnly ? (
        <SheetStatusBadge status={computeSheetStatus(sheet)} />
      ) : (
        <>
          {ALL_STATUSES.map((s) => (
            <Button key={s} size="sm" variant={sheet.final_status === s ? "default" : "outline"} className={sheet.final_status === s ? `${statusColor[s]} text-white` : ""} onClick={() => updateStatus(s)}>
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
        </>
      )}
    >
      {/* Flags */}
      <div className="flex flex-wrap gap-2">
          {sheet.is_draft && <Badge variant="outline" className="border-dashed">Brouillon</Badge>}
          {sheet.sent_to_client && <Badge variant="outline" className="text-[hsl(var(--color-termine))] border-[hsl(var(--color-termine))]"><Mail className="w-3 h-3 mr-1" /> Envoyé</Badge>}
          {sheet.signature_data && <Badge variant="outline" className="text-[hsl(var(--color-termine))] border-[hsl(var(--color-termine))]"><FileSignature className="w-3 h-3 mr-1" /> Signé</Badge>}
          {sheet.client_absent && <Badge variant="outline" className="text-[hsl(var(--color-replanifier))] border-[hsl(var(--color-replanifier))]"><AlertTriangle className="w-3 h-3 mr-1" /> Client absent</Badge>}
          {sheet.client_present && !sheet.client_absent && <Badge variant="outline" className="text-[hsl(var(--color-termine))] border-[hsl(var(--color-termine))]"><User className="w-3 h-3 mr-1" /> Client présent</Badge>}
          {sheet.binome_name && <Badge variant="outline"><User className="w-3 h-3 mr-1" /> Binôme: {sheet.binome_name}</Badge>}
      </div>

      {/* Type d'entretien */}
      {sheet.entretien_type && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm flex items-center gap-2"><Wrench className="w-4 h-4" /> Type d'entretien</h2>
          <div className="p-4 rounded-lg border text-sm">
            <p className="font-medium">{sheet.entretien_type}</p>
            {sheet.entretien_subtype && typeof sheet.entretien_subtype === 'object' && Object.keys(sheet.entretien_subtype).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(sheet.entretien_subtype).filter(([, v]) => v).map(([key]) => (
                  <Badge key={key} variant="outline" className="text-xs">{key}</Badge>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Coordonnées client */}
      <section className="space-y-2">
        <h2 className="font-semibold text-sm">Coordonnées client</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border text-sm space-y-1">
            <h3 className="font-semibold text-xs text-muted-foreground uppercase">Intervention</h3>
            <p className="font-medium">{sheet.client_name_override || task?.clients?.name}</p>
            {(sheet.client_address_override || task?.clients?.address_intervention) && (
              <p className="text-muted-foreground flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0" />{sheet.client_address_override || task.clients.address_intervention}</p>
            )}
            {sheet.client_postal_override && <p className="text-muted-foreground">{sheet.client_postal_override} {sheet.client_city_override}</p>}
            {task?.client_sites?.name && <p className="text-muted-foreground">Site : {task.client_sites.name} — {task.client_sites.address}</p>}
            {(sheet.client_phone_override || task?.clients?.phone) && <p className="text-muted-foreground">📞 {sheet.client_phone_override || task.clients.phone}</p>}
            {(sheet.client_email_override || task?.clients?.email) && <p className="text-muted-foreground">✉️ {sheet.client_email_override || task.clients.email}</p>}
          </div>
          {!sheet.billing_same_as_intervention && sheet.billing_name && (
            <div className="p-4 rounded-lg border text-sm space-y-1">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase">Facturation</h3>
              <p className="font-medium">{sheet.billing_name}</p>
              {sheet.billing_address && <p className="text-muted-foreground">{sheet.billing_address}</p>}
              {sheet.billing_postal_code && <p className="text-muted-foreground">{sheet.billing_postal_code} {sheet.billing_city}</p>}
              {sheet.billing_phone && <p className="text-muted-foreground">📞 {sheet.billing_phone}</p>}
              {sheet.billing_email && <p className="text-muted-foreground">✉️ {sheet.billing_email}</p>}
            </div>
          )}
        </div>
      </section>

      {/* Observations avant intervention */}
      {sheet.observations_before && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Observations avant intervention</h2>
          <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{sheet.observations_before}</p>
        </section>
      )}

      {/* Photos avant */}
      <PhotoGrid photos={photosBefore} label="Photos avant travaux" />

      {/* Plaque signalétique */}
      {(photosNameplate.length > 0 || (sheet.nameplate_data && Object.keys(sheet.nameplate_data).length > 0)) && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Plaque signalétique</h2>
          <PhotoGrid photos={photosNameplate} label="Photos plaque" />
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
          <h2 className="font-semibold text-sm">Checklist ({(sheet.checklist_results as any[]).filter((c: any) => c.checked).length}/{(sheet.checklist_results as any[]).length})</h2>
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
      <PhotoGrid photos={photosAfter} label="Photos après travaux" />

      {/* Horaires */}
      <section className="space-y-2">
        <h2 className="font-semibold text-sm">Horaires et statut</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <User className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Ouvrier</div>
              <div className="font-medium">{worker?.full_name || "—"}</div>
            </div>
          </div>
        </div>
        {(() => {
          const details: string[] =
            (Array.isArray(sheet.work_status_details) && sheet.work_status_details.length > 0
              ? sheet.work_status_details
              : sheet.work_status_detail
                ? [sheet.work_status_detail]
                : []) as string[];
          const notes = (sheet.work_status_notes ?? {}) as Record<string, string>;
          if (details.length === 0) return null;
          return (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">Statut du travail</h3>
              <div className="space-y-2">
                {details.map((d) => (
                  <div key={d} className="p-3 rounded-lg border text-sm">
                    <div className="font-medium">{WORK_STATUS_LABELS[d] ?? d}</div>
                    {notes[d] && (
                      <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{notes[d]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
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
        {!isReadOnly && (
          <div className="flex gap-2">
            <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Ajouter un commentaire..." className="flex-1" rows={2} />
            <Button size="sm" onClick={addComment} disabled={!newComment.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </section>

      {/* Internal photos */}
      {/* Photos internes */}
      <PhotoGrid photos={internalPhotos} label="Photos internes" />
    </LayoutDetail>
  );
}
