import { supabase } from "@/integrations/supabase/client";
import { generateFichePdf, PdfConfig } from "@/lib/generateFichePdf";
import { loadPdfConfigAndLogo, ficheDocumentType } from "@/lib/pdfConfig";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TASK_STATUS_LABELS, INTERVENTION_TYPE_LABELS } from "@/lib/constants";

const AG_EMAIL = "info@agchauffage.be";

/**
 * Generates the fiche PDF, uploads it to storage, and sends it to AG Chauffage.
 */
export async function sendFicheToAG(sheet: any): Promise<void> {
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

  const task = sheet.work_tasks;
  const worker = sheet.profiles;
  const interventionDate = sheet.created_at
    ? format(new Date(sheet.created_at), "dd/MM/yyyy", { locale: fr })
    : "";

  const { error } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "fiche-intervention",
      recipientEmail: AG_EMAIL,
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
      },
    },
  });
  if (error) throw error;
}

/**
 * Sends an "entretien à planifier" reminder to AG Chauffage.
 */
export async function sendEntretienReminderToAG(schedule: any): Promise<void> {
  const client = schedule.clients || {};
  const site = schedule.client_sites || {};
  const equipment = schedule.client_equipment || {};
  const dueDate = schedule.next_due_date
    ? format(new Date(schedule.next_due_date), "dd/MM/yyyy", { locale: fr })
    : "";

  const { error } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "rappel-entretien",
      recipientEmail: AG_EMAIL,
      idempotencyKey: `entretien-${schedule.id}-${schedule.next_due_date ?? ""}`,
      templateData: {
        clientName: client.name || "—",
        clientPhone: client.phone || "",
        clientEmail: client.email || "",
        clientAddress: site.address || client.address_intervention || "",
        clientCity: [client.postal_code, client.city].filter(Boolean).join(" "),
        equipmentName: [equipment.name, equipment.brand, equipment.model].filter(Boolean).join(" "),
        energyType: equipment.energy_type || "",
        interventionType: INTERVENTION_TYPE_LABELS[schedule.intervention_type] || schedule.intervention_type || "Entretien",
        dueDate,
        notes: schedule.notes || "",
      },
    },
  });
  if (error) throw error;
}