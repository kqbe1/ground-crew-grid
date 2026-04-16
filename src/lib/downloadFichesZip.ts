import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { generateFichePdf } from "@/lib/generateFichePdf";
import { generateDevisPdf } from "@/lib/generateDevisPdf";
import type { UnifiedFiche } from "@/components/dashboard/bureau/types";

export async function downloadFichesZip(fiches: UnifiedFiche[]) {
  if (fiches.length === 0) return;

  const zip = new JSZip();

  // Load PDF settings
  const { data: pdfSettings } = await supabase
    .from("pdf_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  const config = pdfSettings ?? {};

  // Fetch logo if available
  let logoDataUrl: string | null = null;
  if (config.logo_url) {
    try {
      const res = await fetch(config.logo_url);
      const blob = await res.blob();
      logoDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { /* ignore logo errors */ }
  }

  // Separate sheets vs quotes
  const sheetIds = fiches.filter((f) => f.sourceTable === "intervention_sheets").map((f) => f.id);
  const quoteIds = fiches.filter((f) => f.sourceTable === "quotes").map((f) => f.id);

  // Batch-fetch intervention sheets
  if (sheetIds.length > 0) {
    const { data: sheets } = await supabase
      .from("intervention_sheets")
      .select(`
        *, 
        work_tasks(*, clients(*)),
        profiles:worker_id(full_name, worker_level)
      `)
      .in("id", sheetIds);

    for (const sheet of sheets ?? []) {
      try {
        const doc = generateFichePdf(sheet, config, logoDataUrl);
        const pdfBlob = doc.output("arraybuffer");
        const clientName = sheet.work_tasks?.clients?.name ?? "inconnu";
        const safeName = clientName.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ _-]/g, "").substring(0, 40);
        const dateStr = new Date(sheet.created_at).toISOString().split("T")[0];
        const type = fiches.find((f) => f.id === sheet.id)?.type ?? "FI";
        zip.file(`${type}_${safeName}_${dateStr}_${sheet.id.substring(0, 6)}.pdf`, pdfBlob);
      } catch { /* skip broken PDFs */ }
    }
  }

  // Batch-fetch quotes
  if (quoteIds.length > 0) {
    const { data: quotes } = await supabase
      .from("quotes")
      .select("*, profiles:created_by(full_name, worker_level)")
      .in("id", quoteIds);

    for (const quote of quotes ?? []) {
      try {
        const doc = generateDevisPdf(quote, config, logoDataUrl);
        const pdfBlob = doc.output("arraybuffer");
        const clientName = quote.client_name ?? "inconnu";
        const safeName = clientName.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ _-]/g, "").substring(0, 40);
        const dateStr = new Date(quote.created_at).toISOString().split("T")[0];
        zip.file(`FD_${safeName}_${dateStr}_${quote.id.substring(0, 6)}.pdf`, pdfBlob);
      } catch { /* skip broken PDFs */ }
    }
  }

  // Generate and download ZIP
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fiches_${new Date().toISOString().split("T")[0]}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
