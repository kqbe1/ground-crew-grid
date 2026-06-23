import jsPDF from "jspdf";
import { TASK_STATUS_LABELS, INTERVENTION_TYPE_LABELS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface PdfConfig {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  company_vat: string;
  logo_url: string | null;
  document_title: string;
  primary_color: string;
  show_horaires: boolean;
  show_description: boolean;
  show_checklist: boolean;
  show_client_state: boolean;
  show_photos_before: boolean;
  show_photos_after: boolean;
  show_signature: boolean;
  show_worker_info: boolean;
  show_client_info: boolean;
  show_intervention_type: boolean;
  footer_text: string;
  text_blocks: any;
}

export interface PdfTextBlock {
  id?: string;
  title?: string;
  content: string;
  position?: "top" | "bottom";
}

const defaultConfig: PdfConfig = {
  company_name: "",
  company_address: "",
  company_phone: "",
  company_email: "",
  company_website: "",
  company_vat: "",
  logo_url: null,
  document_title: "Fiche d'intervention",
  primary_color: "#1a1a2e",
  show_horaires: true,
  show_description: true,
  show_checklist: true,
  show_client_state: true,
  show_photos_before: true,
  show_photos_after: true,
  show_signature: true,
  show_worker_info: true,
  show_client_info: true,
  show_intervention_type: true,
  footer_text: "",
  text_blocks: [],
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) || 26,
    parseInt(h.substring(2, 4), 16) || 26,
    parseInt(h.substring(4, 6), 16) || 46,
  ];
}

export function generateFichePdf(sheet: any, config?: Partial<PdfConfig>, logoDataUrl?: string | null): jsPDF {
  const cfg = { ...defaultConfig, ...config };
  const [pr, pg, pb] = hexToRgb(cfg.primary_color);
  const doc = new jsPDF();
  const task = sheet.work_tasks;
  const worker = sheet.profiles;
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 15;

  const checkPage = (needed: number) => {
    if (y + needed > 275) {
      addFooter();
      doc.addPage();
      y = 20;
    }
  };

  const addFooter = () => {
    // Footer line
    doc.setDrawColor(pr, pg, pb);
    doc.setLineWidth(0.5);
    doc.line(margin, 282, pageW - margin, 282);

    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.setFont("helvetica", "normal");

    const footerParts: string[] = [];
    if (cfg.company_name) footerParts.push(cfg.company_name);
    if (cfg.company_vat) footerParts.push(`TVA: ${cfg.company_vat}`);
    if (cfg.company_phone) footerParts.push(cfg.company_phone);
    if (cfg.company_email) footerParts.push(cfg.company_email);

    if (footerParts.length > 0) {
      doc.text(footerParts.join("  •  "), pageW / 2, 286, { align: "center" });
    }

    if (cfg.footer_text) {
      doc.text(cfg.footer_text, pageW / 2, 290, { align: "center" });
    }

    doc.setTextColor(0);
  };

  const addSection = (title: string) => {
    checkPage(14);
    y += 3;
    doc.setFillColor(pr, pg, pb);
    doc.rect(margin, y - 4, contentW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), margin + 3, y);
    doc.setTextColor(0);
    y += 8;
  };

  const addField = (label: string, value: string, indent = 0) => {
    checkPage(6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(label, margin + indent + 2, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30);
    const labelW = doc.getTextWidth(label);
    doc.text(value || "—", margin + indent + labelW + 4, y);
    y += 5.5;
  };

  const addFieldRow = (pairs: [string, string][]) => {
    checkPage(6);
    const colW = contentW / pairs.length;
    pairs.forEach(([label, value], i) => {
      const x = margin + i * colW + 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(label, x, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30);
      doc.text(value || "—", x + doc.getTextWidth(label) + 3, y);
    });
    y += 5.5;
  };

  const renderTextBlocks = (position: "top" | "bottom") => {
    const blocks = Array.isArray(cfg.text_blocks) ? (cfg.text_blocks as PdfTextBlock[]) : [];
    const matching = blocks.filter((b) => (b?.position ?? "top") === position && (b?.content?.trim() || b?.title?.trim()));
    if (matching.length === 0) return;
    for (const b of matching) {
      checkPage(10);
      if (b.title?.trim()) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(pr, pg, pb);
        doc.text(b.title.trim(), margin + 2, y);
        y += 5;
      }
      if (b.content?.trim()) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(50);
        const lines = doc.splitTextToSize(b.content.trim(), contentW - 4);
        for (const line of lines) {
          checkPage(5);
          doc.text(line, margin + 2, y);
          y += 4.5;
        }
      }
      y += 3;
    }
    doc.setTextColor(0);
  };

  // ═══════════════════════════ HEADER ═══════════════════════════

  // Primary color bar at top
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, pageW, 3, "F");

  // Logo
  let headerRight = margin;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", margin, y, 30, 15);
      headerRight = margin + 35;
    } catch {
      // skip logo
    }
  }

  // Company info next to logo
  const companyX = headerRight;
  let companyY = y + 2;

  if (cfg.company_name) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(pr, pg, pb);
    doc.text(cfg.company_name, companyX, companyY);
    companyY += 5;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);

  if (cfg.company_address) {
    doc.text(cfg.company_address, companyX, companyY);
    companyY += 3.5;
  }

  const contactParts: string[] = [];
  if (cfg.company_phone) contactParts.push(cfg.company_phone);
  if (cfg.company_email) contactParts.push(cfg.company_email);
  if (contactParts.length) {
    doc.text(contactParts.join(" — "), companyX, companyY);
    companyY += 3.5;
  }
  if (cfg.company_vat) {
    doc.text(`TVA: ${cfg.company_vat}`, companyX, companyY);
    companyY += 3.5;
  }

  y = Math.max(y + 18, companyY + 3);

  // Document title
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 5, contentW, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(pr, pg, pb);
  doc.text(cfg.document_title, pageW / 2, y + 1, { align: "center" });
  y += 10;

  // Generation date + reference
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130);
  doc.text(`Réf: FI-${sheet.id?.substring(0, 8)?.toUpperCase() || "XXXX"}  •  ${format(new Date(), "d MMMM yyyy à HH:mm", { locale: fr })}`, pageW / 2, y, { align: "center" });
  y += 8;

  // Custom text blocks (top)
  renderTextBlocks("top");

  // ═══════════════════════════ INFO SECTION ═══════════════════════════
  addSection("Informations générales");

  addField("Titre :", task?.title || "—");

  if (cfg.show_intervention_type) {
    const typeLabel = task?.intervention_type ? INTERVENTION_TYPE_LABELS[task.intervention_type] || task.intervention_type : "—";
    addField("Type :", typeLabel);

    // Entretien type details (sub-options)
    if (sheet.entretien_type) {
      addField("Type d'entretien :", sheet.entretien_type);
    }
    if (sheet.entretien_subtype && typeof sheet.entretien_subtype === "object") {
      const sub = sheet.entretien_subtype as Record<string, any>;
      const subFields: string[] = [];
      if (sub.combustible) subFields.push(`Combustible: ${sub.combustible}`);
      if (sub.montage) subFields.push(`Montage: ${sub.montage}`);
      if (sub.tirage) subFields.push(`Tirage: ${sub.tirage}`);
      if (sub.ventilation) subFields.push(`Ventilation: ${sub.ventilation}`);
      if (sub.regulation) subFields.push(`Régulation: ${sub.regulation}`);
      if (subFields.length > 0) {
        for (const sf of subFields) {
          addField("  ", sf);
        }
      }
    }
  }

  addField("Statut :", TASK_STATUS_LABELS[sheet.final_status] || sheet.final_status);
  const statusLabels: Record<string, string> = {
    termine: "Travail terminé",
    piece_a_commander: "Pièce à commander",
    piece_commandee: "Pièce commandée",
    a_refixer: "A refixer pour autre travail",
    sav: "SAV",
    autre: "Autre",
  };
  const details: string[] = Array.isArray(sheet.work_status_details) && sheet.work_status_details.length > 0
    ? sheet.work_status_details
    : (sheet.work_status_detail ? [sheet.work_status_detail] : []);
  const notes: Record<string, string> = sheet.work_status_notes ?? {};
  for (const d of details) {
    addField("• " + (statusLabels[d] ?? d), notes[d] ? notes[d] : "");
  }
  if (sheet.status_comment && details.length === 0) {
    addField("Commentaire statut :", sheet.status_comment);
  }
  addField("Date :", format(new Date(sheet.created_at), "d MMMM yyyy", { locale: fr }));

  if (sheet.is_draft) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 50, 50);
    doc.text("⚠ BROUILLON", margin + 2, y);
    doc.setTextColor(0);
    y += 6;
  }

  // ═══════════════════════════ CLIENT ═══════════════════════════
  if (cfg.show_client_info) {
    addSection("Client");
    // Use override coordinates if available
    const clientName = sheet.client_name_override || task?.clients?.name || "—";
    const clientEmail = sheet.client_email_override || task?.clients?.email;
    const clientPhone = sheet.client_phone_override || task?.clients?.phone;
    const clientAddress = sheet.client_address_override || task?.clients?.address_intervention;
    const clientPostal = sheet.client_postal_override;
    const clientCity = sheet.client_city_override;

    addField("Nom :", clientName);
    if (clientEmail) addField("Email :", clientEmail);
    if (clientPhone) addField("Téléphone :", clientPhone);
    if (clientAddress) {
      let addr = clientAddress;
      if (clientPostal || clientCity) addr += `, ${clientPostal || ""} ${clientCity || ""}`.trim();
      addField("Adresse :", addr);
    }

    // Billing address if different
    if (sheet.billing_same_as_intervention === false && sheet.billing_name) {
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text("Adresse de facturation :", margin + 2, y);
      y += 5;
      addField("Nom :", sheet.billing_name || "—");
      if (sheet.billing_address) {
        let bAddr = sheet.billing_address;
        if (sheet.billing_postal_code || sheet.billing_city) bAddr += `, ${sheet.billing_postal_code || ""} ${sheet.billing_city || ""}`.trim();
        addField("Adresse :", bAddr);
      }
      if (sheet.billing_phone) addField("Téléphone :", sheet.billing_phone);
      if (sheet.billing_email) addField("Email :", sheet.billing_email);
    }
  }

  // ═══════════════════════════ WORKER ═══════════════════════════
  if (cfg.show_worker_info) {
    addSection("Technicien");
    addField("Nom :", worker?.full_name || "—");
    if (sheet.binome_name) {
      addField("Binôme :", `${sheet.binome_name} (${sheet.binome_percentage || 0}%)`);
    }
  }

  // ═══════════════════════════ HORAIRES ═══════════════════════════
  if (cfg.show_horaires) {
    addSection("Horaires");
    addFieldRow([
      ["Arrivée :", sheet.arrival_time ? format(new Date(sheet.arrival_time), "HH:mm") : "—"],
      ["Départ :", sheet.departure_time ? format(new Date(sheet.departure_time), "HH:mm") : "—"],
    ]);
  }

  // ═══════════════════════════ OBSERVATIONS ═══════════════════════════
  if (sheet.observations_before) {
    addSection("Observations à l'arrivée");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(sheet.observations_before, contentW - 4);
    for (const line of lines) {
      checkPage(5);
      doc.text(line, margin + 2, y);
      y += 4.5;
    }
    y += 2;
  }

  // ═══════════════════════════ DESCRIPTION ═══════════════════════════
  if (cfg.show_description && sheet.description) {
    addSection("Description du travail");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(sheet.description, contentW - 4);
    for (const line of lines) {
      checkPage(5);
      doc.text(line, margin + 2, y);
      y += 4.5;
    }
    y += 2;
  }

  // ═══════════════════════════ SUPPLIES ═══════════════════════════
  if (sheet.supplies_description) {
    addSection("Fournitures utilisées");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(sheet.supplies_description, contentW - 4);
    for (const line of lines) {
      checkPage(5);
      doc.text(line, margin + 2, y);
      y += 4.5;
    }
    y += 2;
  }

  // ═══════════════════════════ NAMEPLATE ═══════════════════════════
  if (sheet.nameplate_data && typeof sheet.nameplate_data === "object") {
    const np = sheet.nameplate_data as Record<string, string>;
    const hasData = Object.values(np).some((v) => v && v.trim());
    if (hasData) {
      addSection("Plaque signalétique");
      const npFields: [string, string][] = [
        ["Marque", np.brand], ["Modèle", np.model], ["N° série", np.serialNumber],
        ["Puiss. nominale", np.nominalPower], ["Puiss. utile", np.usefulPower],
        ["Combustible", np.fuelType], ["Pression", np.servicePressure],
        ["Débit calor.", np.caloricFlow], ["Année", np.yearOfManufacture],
        ["N° CE", np.ceNumber], ["Catégorie", np.category], ["Autres", np.otherInfo],
      ];
      for (const [label, value] of npFields) {
        if (value && value.trim()) addField(`${label} :`, value);
      }
    }
  }

  // ═══════════════════════════ CHECKLIST ═══════════════════════════
  if (cfg.show_checklist && sheet.checklist_results) {
    // Handle both old array format and new object format
    if (Array.isArray(sheet.checklist_results) && sheet.checklist_results.length > 0) {
      addSection("Points de contrôle");
      for (const item of sheet.checklist_results as any[]) {
        checkPage(6);
        const checked = item.checked;
        doc.setDrawColor(pr, pg, pb);
        doc.setLineWidth(0.3);
        doc.rect(margin + 2, y - 3, 3.5, 3.5);
        if (checked) {
          doc.setFillColor(pr, pg, pb);
          doc.rect(margin + 2.5, y - 2.5, 2.5, 2.5, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(30);
        doc.text(item.label || item.name || "—", margin + 8, y);
        y += 5.5;
      }
    } else if (typeof sheet.checklist_results === "object" && !Array.isArray(sheet.checklist_results)) {
      const items = Object.entries(sheet.checklist_results as Record<string, boolean>);
      const checked = items.filter(([, v]) => v);
      if (checked.length > 0) {
        addSection("Checklist entretien");
        for (const [name, isChecked] of items) {
          checkPage(6);
          doc.setDrawColor(pr, pg, pb);
          doc.setLineWidth(0.3);
          doc.rect(margin + 2, y - 3, 3.5, 3.5);
          if (isChecked) {
            doc.setFillColor(pr, pg, pb);
            doc.rect(margin + 2.5, y - 2.5, 2.5, 2.5, "F");
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(30);
          doc.text(name, margin + 8, y);
          y += 5.5;
        }
      }
    }
  }

  // ═══════════════════════════ CLIENT STATE ═══════════════════════════
  if (cfg.show_client_state) {
    addSection("Présence client");
    addFieldRow([
      ["Client présent :", sheet.client_present ? "Oui" : "Non"],
      ["Client absent :", sheet.client_absent ? "Oui" : "Non"],
    ]);
  }

  // ═══════════════════════════ PHOTOS ═══════════════════════════
  const addPhotos = (photos: string[], title: string) => {
    if (!photos || photos.length === 0) return;
    addSection(title);
    let col = 0;
    for (const photo of photos) {
      try {
        checkPage(55);
        const x = margin + col * 55;
        doc.addImage(photo, "JPEG", x, y, 50, 50);
        col++;
        if (col >= 3) {
          col = 0;
          y += 55;
        }
      } catch {
        // skip
      }
    }
    if (col > 0) y += 55;
  };

  if (cfg.show_photos_before) {
    addPhotos(sheet.photos_before, "Photos avant intervention");
  }
  if (cfg.show_photos_after) {
    addPhotos(sheet.photos_after, "Photos après intervention");
  }

  // ═══════════════════════════ SIGNATURE ═══════════════════════════
  if (cfg.show_signature) {
    addSection("Signature client");
    if (sheet.client_absent || !sheet.client_present) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(120);
      checkPage(8);
      doc.text("Client absent — Pas de signature", margin + 2, y);
      doc.setTextColor(0);
      y += 8;
    } else if (sheet.signature_data) {
      try {
        checkPage(40);
        doc.addImage(sheet.signature_data, "PNG", margin + 2, y, 60, 30);
        y += 33;
        if (sheet.signed_at) {
          doc.setFontSize(8);
          doc.setTextColor(120);
          doc.text(`Signé le ${format(new Date(sheet.signed_at), "d MMMM yyyy à HH:mm", { locale: fr })}`, margin + 2, y);
          doc.setTextColor(0);
          y += 5;
        }
      } catch {
        // skip
      }
    }
  }

  // Custom text blocks (bottom)
  renderTextBlocks("bottom");

  // Final footer
  addFooter();

  return doc;
}

export function downloadFichePdf(sheet: any, config?: Partial<PdfConfig>, logoDataUrl?: string | null) {
  const doc = generateFichePdf(sheet, config, logoDataUrl);
  const clientName = sheet.work_tasks?.clients?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "client";
  const date = format(new Date(sheet.created_at), "yyyy-MM-dd");
  doc.save(`fiche_${clientName}_${date}.pdf`);
}
