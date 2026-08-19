import { supabase } from "@/integrations/supabase/client";
import { generateFichePdf, PdfConfig } from "@/lib/generateFichePdf";
import { loadPdfConfigAndLogo, ficheDocumentType, withPdfPhotos } from "@/lib/pdfConfig";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TASK_STATUS_LABELS, INTERVENTION_TYPE_LABELS } from "@/lib/constants";

async function currentCompanyId(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  return prof?.company_id ?? null;
}

/** Charge la configuration email de l'entreprise courante uniquement. */
async function loadSettings(templateKey: "fiche-intervention" | "rappel-entretien") {
  const companyId = await currentCompanyId();
  if (!companyId) return null;
  const { data } = await supabase
    .from("email_settings")
    .select("subject, intro_text, footer_text, contact_phone, contact_email")
    .eq("company_id", companyId)
    .eq("template_key", templateKey)
    .maybeSingle();
  return data;
}

/** Résout l'adresse email destinataire d'une fiche (override > client > facturation). */
export function resolveFicheEmail(sheet: any): string {
  return (
    sheet?.client_email_override ||
    sheet?.work_tasks?.clients?.email ||
    sheet?.billing_email ||
    ""
  ).trim();
}

/**
 * Generates the fiche PDF, uploads it to storage, and sends it to the client's email.
 * Throws if the client has no email address.
 */
export async function sendFicheToAG(
  sheet: any,
  overrides?: Partial<PdfConfig>,
  recipientOverride?: string,
): Promise<void> {
  const task = sheet.work_tasks;
  const clientEmail = (recipientOverride || resolveFicheEmail(sheet)).trim();
  if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    throw new Error("Ce client n'a pas d'adresse email");
  }

  const settings = await loadSettings("fiche-intervention");

  const { pdfCfg, logoDataUrl } = await loadPdfConfigAndLogo(ficheDocumentType(sheet));
  const mergedCfg = { ...((pdfCfg as Partial<PdfConfig>) || {}), ...(overrides || {}) };
  const doc = generateFichePdf(await withPdfPhotos(sheet), mergedCfg, logoDataUrl);
  const blob = doc.output("blob");

  // Upload to the private fiche-pdfs bucket (never public)
  const id = crypto.randomUUID();
  let companyId: string | null = sheet.company_id ?? null;
  if (!companyId) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", auth.user.id)
        .maybeSingle();
      companyId = prof?.company_id ?? null;
    }
  }
  if (!companyId) throw new Error("Entreprise introuvable pour l'envoi");
  // Storage RLS requires the first folder to be the company id
  const filePath = `${companyId}/${id}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("fiche-pdfs")
    .upload(filePath, blob, { contentType: "application/pdf", upsert: false });
  if (upErr) throw upErr;

  // Signed URL valid 90 days so the client can open the PDF from the email
  const { data: signed, error: signErr } = await supabase.storage
    .from("fiche-pdfs")
    .createSignedUrl(filePath, 60 * 60 * 24 * 90);
  if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Impossible de générer le lien du PDF");
  const pdfUrl = signed.signedUrl;

  const worker = sheet.profiles;
  const interventionDate = sheet.created_at
    ? format(new Date(sheet.created_at), "dd/MM/yyyy", { locale: fr })
    : "";

  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      templateName: "fiche-intervention",
      recipientEmail: clientEmail,
      idempotencyKey: `fiche-${sheet.id}-${Date.now()}`,
      templateData: {
        clientName: sheet.client_name_override || task?.clients?.name || "—",
        clientCity: task?.clients?.city || "",
        taskTitle: task?.title || "Intervention",
        interventionDate,
        workerName: worker?.full_name || "",
        finalStatus: sheet.final_status ? TASK_STATUS_LABELS[sheet.final_status] : "",
        description: sheet.description || "",
        pdfUrl,
        customSubject: settings?.subject || "",
        introText: settings?.intro_text || undefined,
        footerText: settings?.footer_text || undefined,
      },
    },
  });
  if (error) throw error;

  // Mark sheet as sent to client
  await supabase.from("intervention_sheets").update({ sent_to_client: true }).eq("id", sheet.id);
}

/**
 * Sends an "entretien à planifier" reminder to the client to schedule a rendezvous.
 * Throws if the client has no email address.
 */
export async function sendEntretienReminderToAG(schedule: any): Promise<void> {
  const client = schedule.clients || {};
  const equipment = schedule.client_equipment || {};
  const clientEmail = client.email;
  if (!clientEmail) {
    throw new Error("Ce client n'a pas d'adresse email");
  }

  const settings = await loadSettings("rappel-entretien");

  const dueDate = schedule.next_due_date
    ? format(new Date(schedule.next_due_date), "dd/MM/yyyy", { locale: fr })
    : "";

  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      templateName: "rappel-entretien",
      recipientEmail: clientEmail,
      idempotencyKey: `entretien-${schedule.id}-${schedule.next_due_date ?? ""}`,
      templateData: {
        clientName: client.name || "—",
        equipmentName: [equipment.name, equipment.brand, equipment.model].filter(Boolean).join(" "),
        energyType: equipment.energy_type || "",
        interventionType: INTERVENTION_TYPE_LABELS[schedule.intervention_type] || schedule.intervention_type || "Entretien",
        dueDate,
        contactPhone: settings?.contact_phone || "",
        contactEmail: settings?.contact_email || "",
        customSubject: settings?.subject || "",
        introText: settings?.intro_text || undefined,
        footerText: settings?.footer_text || undefined,
      },
    },
  });
  if (error) throw error;
}