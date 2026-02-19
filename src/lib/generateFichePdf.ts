import jsPDF from "jspdf";
import { TASK_STATUS_LABELS, INTERVENTION_TYPE_LABELS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function generateFichePdf(sheet: any): jsPDF {
  const doc = new jsPDF();
  const task = sheet.work_tasks;
  const worker = sheet.profiles;
  const margin = 20;
  let y = 20;

  const addLine = (label: string, value: string, indent = 0) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, margin + indent, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "—", margin + indent + doc.getTextWidth(label) + 3, y);
    y += 6;
  };

  const addSection = (title: string) => {
    if (y > 260) { doc.addPage(); y = 20; }
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(title, margin, y);
    y += 2;
    doc.setDrawColor(200);
    doc.line(margin, y, 190, y);
    y += 6;
    doc.setTextColor(0);
    doc.setFontSize(10);
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Fiche d'intervention", margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Générée le ${format(new Date(), "d MMMM yyyy à HH:mm", { locale: fr })}`, margin, y);
  doc.setTextColor(0);
  y += 10;

  // Info section
  addSection("Informations générales");
  addLine("Titre :", task?.title || "—");
  addLine("Type :", task?.intervention_type ? INTERVENTION_TYPE_LABELS[task.intervention_type] || task.intervention_type : "—");
  addLine("Statut :", TASK_STATUS_LABELS[sheet.final_status] || sheet.final_status);
  addLine("Client :", task?.clients?.name || "—");
  addLine("Email client :", task?.clients?.email || "—");
  addLine("Ouvrier :", worker?.full_name || "—");
  addLine("Date :", format(new Date(sheet.created_at), "d MMMM yyyy", { locale: fr }));
  if (sheet.is_draft) addLine("", "⚠ Brouillon");

  // Horaires
  addSection("Horaires");
  addLine("Arrivée :", sheet.arrival_time ? format(new Date(sheet.arrival_time), "HH:mm") : "—");
  addLine("Départ :", sheet.departure_time ? format(new Date(sheet.departure_time), "HH:mm") : "—");

  // Description
  if (sheet.description) {
    addSection("Description");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(sheet.description, 170);
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(line, margin, y);
      y += 5;
    }
  }

  // Checklist
  if (sheet.checklist_results && Array.isArray(sheet.checklist_results) && sheet.checklist_results.length > 0) {
    addSection("Checklist");
    for (const item of sheet.checklist_results as any[]) {
      const icon = item.checked ? "☑" : "☐";
      addLine(`${icon}`, item.label || item.name || "—");
    }
  }

  // Flags
  addSection("État");
  addLine("Client présent :", sheet.client_present ? "Oui" : "Non");
  addLine("Client absent :", sheet.client_absent ? "Oui" : "Non");
  addLine("Signé :", sheet.signature_data ? "Oui" : "Non");
  addLine("Envoyé :", sheet.sent_to_client ? "Oui" : "Non");

  // Signature image
  if (sheet.signature_data) {
    addSection("Signature client");
    try {
      if (y + 45 > 280) { doc.addPage(); y = 20; }
      doc.addImage(sheet.signature_data, "PNG", margin, y, 60, 30);
      y += 35;
      if (sheet.signed_at) {
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Signé le ${format(new Date(sheet.signed_at), "d MMMM yyyy à HH:mm", { locale: fr })}`, margin, y);
        doc.setTextColor(0);
        y += 6;
      }
    } catch {
      addLine("", "(signature non intégrable)");
    }
  }

  return doc;
}

export function downloadFichePdf(sheet: any) {
  const doc = generateFichePdf(sheet);
  const clientName = sheet.work_tasks?.clients?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "client";
  const date = format(new Date(sheet.created_at), "yyyy-MM-dd");
  doc.save(`fiche_${clientName}_${date}.pdf`);
}
