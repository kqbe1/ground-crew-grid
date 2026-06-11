import jsPDF from "jspdf";
import { QUOTE_STATUS_LABELS, INSTALLATION_TYPE_LABELS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface DevisPdfConfig {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  company_vat: string;
  logo_url: string | null;
  primary_color: string;
  footer_text: string;
  document_title: string;
  text_blocks: any;
}

export interface DevisTextBlock {
  id?: string;
  title?: string;
  content: string;
  position?: "top" | "bottom";
}

const defaultConfig: DevisPdfConfig = {
  company_name: "",
  company_address: "",
  company_phone: "",
  company_email: "",
  company_website: "",
  company_vat: "",
  logo_url: null,
  primary_color: "#1a1a2e",
  footer_text: "",
  document_title: "",
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

const INSULATION_LABELS: Record<string, string> = {
  good: "Bonne",
  average: "Moyenne",
  bad: "Mauvaise",
};

const INSULATION_COEFF: Record<string, number> = {
  good: 30,
  average: 40,
  bad: 50,
};

export function generateDevisPdf(
  quote: any,
  config?: Partial<DevisPdfConfig>,
  logoDataUrl?: string | null
): jsPDF {
  const cfg = { ...defaultConfig, ...config };
  const [pr, pg, pb] = hexToRgb(cfg.primary_color);
  const doc = new jsPDF();
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
    doc.setDrawColor(pr, pg, pb);
    doc.setLineWidth(0.5);
    doc.line(margin, 282, pageW - margin, 282);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.setFont("helvetica", "normal");
    const parts: string[] = [];
    if (cfg.company_name) parts.push(cfg.company_name);
    if (cfg.company_vat) parts.push(`TVA: ${cfg.company_vat}`);
    if (cfg.company_phone) parts.push(cfg.company_phone);
    if (cfg.company_email) parts.push(cfg.company_email);
    if (parts.length > 0) {
      doc.text(parts.join("  •  "), pageW / 2, 286, { align: "center" });
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

  const addField = (label: string, value: string) => {
    checkPage(6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(label, margin + 2, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30);
    const labelW = doc.getTextWidth(label);
    doc.text(value || "—", margin + labelW + 4, y);
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
    const blocks = Array.isArray(cfg.text_blocks) ? (cfg.text_blocks as DevisTextBlock[]) : [];
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

  // ═══════════ HEADER ═══════════
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, pageW, 3, "F");

  let headerRight = margin;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", margin, y, 30, 15);
      headerRight = margin + 35;
    } catch {
      // skip
    }
  }

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

  // Title bar
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 5, contentW, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(pr, pg, pb);
  const installLabel = INSTALLATION_TYPE_LABELS[quote.installation_type] || quote.installation_type;
  const titleText = cfg.document_title?.trim()
    ? `${cfg.document_title.trim().toUpperCase()} — ${installLabel}`
    : `DEVIS — ${installLabel}`;
  doc.text(titleText, pageW / 2, y + 1, { align: "center" });
  y += 10;

  // Ref + date
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130);
  doc.text(
    `Réf: DV-${quote.id?.substring(0, 8)?.toUpperCase() || "XXXX"}  •  ${format(new Date(quote.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}`,
    pageW / 2,
    y,
    { align: "center" }
  );
  y += 4;

  // Status badge
  doc.setFontSize(8);
  doc.setTextColor(pr, pg, pb);
  doc.setFont("helvetica", "bold");
  doc.text(`Statut : ${QUOTE_STATUS_LABELS[quote.status] || quote.status}`, pageW / 2, y + 2, { align: "center" });
  y += 8;

  // Custom text blocks (top)
  renderTextBlocks("top");

  // Urgency
  if (quote.is_urgent) {
    checkPage(8);
    doc.setFillColor(220, 50, 50);
    doc.roundedRect(margin, y - 4, 40, 7, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("URGENT", margin + 3, y);
    doc.setTextColor(0);
    y += 8;
  }

  // ═══════════ CLIENT ═══════════
  addSection("Coordonnées client");
  addField("Nom :", quote.client_name);
  if (quote.client_address) addField("Adresse :", quote.client_address);
  addFieldRow([
    ["Code postal :", quote.client_postal_code || "—"],
    ["Ville :", quote.client_city || "—"],
  ]);
  if (quote.client_phone) addField("Téléphone :", quote.client_phone);
  if (quote.client_email) addField("Email :", quote.client_email);

  // Billing
  if (!quote.billing_same_as_intervention) {
    addSection("Adresse de facturation");
    if (quote.billing_address) addField("Adresse :", quote.billing_address);
    addFieldRow([
      ["Code postal :", quote.billing_postal_code || "—"],
      ["Ville :", quote.billing_city || "—"],
    ]);
  }

  // ═══════════ INSTALLATION FLAGS ═══════════
  if (quote.existing_installation_remove || quote.existing_installation_complete || quote.work_description) {
    addSection("Description des travaux");

    if (quote.existing_installation_remove) {
      addField("Installation existante :", "À retirer");
    }
    if (quote.existing_installation_complete) {
      addField("Installation existante :", "À compléter");
    }

    if (quote.work_description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30);
      const lines = doc.splitTextToSize(quote.work_description, contentW - 4);
      for (const line of lines) {
        checkPage(5);
        doc.text(line, margin + 2, y);
        y += 4.5;
      }
      y += 2;
    }
  }

  // ═══════════ ROOMS ═══════════
  const rooms: any[] = Array.isArray(quote.rooms_data) ? quote.rooms_data : [];
  if (rooms.length > 0) {
    addSection(`Pièces (${rooms.length})`);
    rooms.forEach((room, idx) => {
      checkPage(22);
      const roomName = room.type || `Pièce ${idx + 1}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(pr, pg, pb);
      doc.text(roomName, margin + 2, y);
      y += 5;

      const l = parseFloat(room.length) || 0;
      const w = parseFloat(room.width) || 0;
      const h = parseFloat(room.height) || 0;
      const vol = l * w * h;
      const coeff = INSULATION_COEFF[room.insulation] || 40;
      const wattage = room.wattage || Math.round(vol * coeff);

      addFieldRow([
        ["Dimensions :", `${l}m × ${w}m × ${h}m (${vol.toFixed(1)} m³)`],
        ["Isolation :", INSULATION_LABELS[room.insulation] || "—"],
      ]);
      addField("Puissance estimée :", `${wattage} W`);

      if (room.remark) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(100);
        checkPage(5);
        doc.text(`Remarque : ${room.remark}`, margin + 4, y);
        doc.setTextColor(0);
        y += 5;
      }
      y += 2;
    });
  }

  // ═══════════ CHECKLIST ═══════════
  const checklist = quote.checklist_data && typeof quote.checklist_data === "object" ? quote.checklist_data : {};
  const checklistEntries = Object.entries(checklist);
  if (checklistEntries.length > 0) {
    addSection(`Checklist — ${installLabel}`);
    for (const [item, checked] of checklistEntries) {
      checkPage(6);
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
      doc.text(String(item), margin + 8, y);
      y += 5.5;
    }
  }

  // ═══════════ PLAN PHOTOS ═══════════
  const planPhotos: string[] = Array.isArray(quote.plan_photos) ? quote.plan_photos : [];
  if (planPhotos.length > 0) {
    addSection("Plans de l'installation");
    let col = 0;
    for (const photo of planPhotos) {
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
  }

  // ═══════════ PHOTOS ═══════════
  const photos: string[] = Array.isArray(quote.photos) ? quote.photos : [];
  if (photos.length > 0) {
    addSection(`Photos (${photos.length})`);
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
  }

  // ═══════════ VOICE NOTES MENTION ═══════════
  const voiceNotes: string[] = Array.isArray(quote.voice_notes) ? quote.voice_notes : [];
  if (voiceNotes.length > 0) {
    addSection("Notes vocales");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(
      `${voiceNotes.length} note(s) vocale(s) jointe(s) au dossier numérique.`,
      margin + 2,
      y
    );
    y += 6;
  }

  // ═══════════ CREATED BY ═══════════
  if (quote.profiles?.full_name) {
    addSection("Créé par");
    addField("Technicien :", quote.profiles.full_name);
  }

  // Custom text blocks (bottom)
  renderTextBlocks("bottom");

  addFooter();
  return doc;
}

export function downloadDevisPdf(
  quote: any,
  config?: Partial<DevisPdfConfig>,
  logoDataUrl?: string | null
) {
  const doc = generateDevisPdf(quote, config, logoDataUrl);
  const clientName = quote.client_name?.replace(/[^a-zA-Z0-9]/g, "_") || "client";
  const date = format(new Date(quote.created_at), "yyyy-MM-dd");
  doc.save(`devis_${clientName}_${date}.pdf`);
}
