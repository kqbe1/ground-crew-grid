import { supabase } from "@/integrations/supabase/client";
import { generateFichePdf, PdfConfig } from "@/lib/generateFichePdf";
import { loadPdfConfigAndLogo, ficheDocumentType } from "@/lib/pdfConfig";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TASK_STATUS_LABELS, INTERVENTION_TYPE_LABELS } from "@/lib/constants";

async function loadSettings(templateKey: "fiche-intervention" | "rappel-entretien") {
  const { data } = await supabase
    .from("email_settings")
    .select("subject, intro_text, footer_text, contact_phone, contact_email")
    .eq("template_key", templateKey)
    .maybeSingle();
  return data;
}

/**
 * Generates the fiche PDF, uploads it to storage, and sends it to the client's email.
 * Throws if the client has no email address.
 */
export async function sendFicheToAG(sheet: any): Promise<void> {
  const task = sheet.work_tasks;
  const clientEmail = task?.clients?.email;
  if (!clientEmail) {
    throw new Error("Ce client n'a pas d'adresse email");
  }

  const settings = await loadSettings("fiche-intervention");

  const { pdfCfg, logoDataUrl } = await loadPdfConfigAndLogo(ficheDocumentType(sheet));
  const doc = generateFichePdf(sheet, pdfCfg as Partial<PdfConfig> | undefined, logoDataUrl);
  const blob = doc.output("blob");

  // Upload to public company-assets bucket
  const id = crypto.randomUUID();
  const filePath = `email-attachments/${id}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("company-assets")
    .upload(filePath, blob, { contentType: "application/pdf", upsert: false });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from("company-assets").getPublicUrl(filePath);
  const pdfUrl = pub.publicUrl;

  const worker = sheet.profiles;
  const interventionDate = sheet.created_at
    ? format(new Date(sheet.created_at), "dd/MM/yyyy", { locale: fr })
    : "";

  const { error } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "fiche-intervention",
      recipientEmail: clientEmail,
      idempotencyKey: `fiche-${sheet.id}`,
      templateData: {
        clientName: task?.clients?.name || "—",
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

  const { error } = await supabase.functions.invoke("send-transactional-email", {
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
        contactEmail: settings?.contact_email || "info@agchauffage.be",
        customSubject: settings?.subject || "",
        introText: settings?.intro_text || undefined,
        footerText: settings?.footer_text || undefined,
      },
    },
  });
  if (error) throw error;
}