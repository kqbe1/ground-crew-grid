import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { generateFichePdf } from "@/lib/generateFichePdf";
import { generateDevisPdf } from "@/lib/generateDevisPdf";
import type { UnifiedFiche } from "@/components/dashboard/bureau/types";
import { fetchLogoDataUrl, ficheDocumentType, withPdfPhotos } from "@/lib/pdfConfig";

export type ZipExportResult = {
  total: number;
  succeeded: number;
  failed: { label: string; reason: string }[];
};

export async function downloadFichesZip(fiches: UnifiedFiche[]): Promise<ZipExportResult> {
  const failed: { label: string; reason: string }[] = [];
  let succeeded = 0;
  if (fiches.length === 0) return { total: 0, succeeded: 0, failed };

  const zip = new JSZip();

  // Load all PDF settings rows for the current company, keyed by document_type.
  const { data: { user } } = await supabase.auth.getUser();
  let companyId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();
    companyId = profile?.company_id ?? null;
  }

  const { data: allSettings } = companyId
    ? await supabase.from("pdf_settings").select("*").eq("company_id", companyId)
    : await supabase.from("pdf_settings").select("*").limit(1);

  const settingsByType: Record<string, any> = {};
  for (const s of allSettings ?? []) settingsByType[s.document_type] = s;
  const fallback = settingsByType["fiche_intervention"] ?? (allSettings ?? [])[0] ?? {};
  const getConfig = (docType: string) => settingsByType[docType] ?? fallback;

  // Cache logos by path (one company can use the same logo across types).
  const logoCache: Record<string, string | null> = {};
  const getLogo = async (path: string | null | undefined) => {
    if (!path) return null;
    if (path in logoCache) return logoCache[path];
    const data = await fetchLogoDataUrl(path);
    logoCache[path] = data;
    return data;
  };

  // Separate sheets vs quotes
  const sheetIds = fiches.filter((f) => f.sourceTable === "intervention_sheets").map((f) => f.id);
  const quoteIds = fiches.filter((f) => f.sourceTable === "quotes").map((f) => f.id);

  // Batch-fetch intervention sheets
  if (sheetIds.length > 0) {
    const { data: sheets, error: sheetsErr } = await supabase
      .from("intervention_sheets")
      .select(`
        *, 
        work_tasks(*, clients(*)),
        profiles:worker_id(full_name, worker_level)
      `)
      .in("id", sheetIds);

    if (sheetsErr) {
      for (const sid of sheetIds) failed.push({ label: `Fiche ${sid.substring(0, 6)}`, reason: sheetsErr.message });
    }
    for (const sid of sheetIds) {
      if (!(sheets ?? []).some((s: any) => s.id === sid) && !sheetsErr) {
        failed.push({ label: `Fiche ${sid.substring(0, 6)}`, reason: "Fiche introuvable ou accès refusé" });
      }
    }

    for (const sheet of sheets ?? []) {
      const clientNameForError = sheet.work_tasks?.clients?.name ?? sheet.id.substring(0, 6);
      try {
        const config = getConfig(ficheDocumentType(sheet));
        const logoDataUrl = await getLogo(config?.logo_url);
        const doc = generateFichePdf(await withPdfPhotos(sheet), config, logoDataUrl);
        const pdfBlob = doc.output("arraybuffer");
        const clientName = sheet.work_tasks?.clients?.name ?? "inconnu";
        const safeName = clientName.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ _-]/g, "").substring(0, 40);
        const dateStr = new Date(sheet.created_at).toISOString().split("T")[0];
        const type = fiches.find((f) => f.id === sheet.id)?.type ?? "FI";
        zip.file(`${type}_${safeName}_${dateStr}_${sheet.id.substring(0, 6)}.pdf`, pdfBlob);
        succeeded++;
      } catch (e: any) {
        failed.push({ label: `Fiche ${clientNameForError}`, reason: e?.message ?? "Erreur de génération du PDF" });
      }
    }
  }

  // Batch-fetch quotes
  if (quoteIds.length > 0) {
    const { data: quotes, error: quotesErr } = await supabase
      .from("quotes")
      .select("*, profiles:created_by(full_name, worker_level)")
      .in("id", quoteIds);

    if (quotesErr) {
      for (const qid of quoteIds) failed.push({ label: `Devis ${qid.substring(0, 6)}`, reason: quotesErr.message });
    }
    for (const qid of quoteIds) {
      if (!(quotes ?? []).some((q: any) => q.id === qid) && !quotesErr) {
        failed.push({ label: `Devis ${qid.substring(0, 6)}`, reason: "Devis introuvable ou accès refusé" });
      }
    }

    for (const quote of quotes ?? []) {
      try {
        const config = getConfig("devis");
        const logoDataUrl = await getLogo(config?.logo_url);
        const doc = generateDevisPdf(quote, config, logoDataUrl);
        const pdfBlob = doc.output("arraybuffer");
        const clientName = quote.client_name ?? "inconnu";
        const safeName = clientName.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ _-]/g, "").substring(0, 40);
        const dateStr = new Date(quote.created_at).toISOString().split("T")[0];
        zip.file(`FD_${safeName}_${dateStr}_${quote.id.substring(0, 6)}.pdf`, pdfBlob);
        succeeded++;
      } catch (e: any) {
        failed.push({ label: `Devis ${quote.client_name ?? quote.id.substring(0, 6)}`, reason: e?.message ?? "Erreur de génération du PDF" });
      }
    }
  }

  // Report failures inside the archive so they are never silently swallowed
  if (failed.length > 0) {
    zip.file(
      "_ERREURS.txt",
      [
        `Export du ${new Date().toLocaleString("fr-BE")}`,
        `${succeeded} document(s) exporté(s), ${failed.length} en erreur :`,
        "",
        ...failed.map((f) => `- ${f.label} : ${f.reason}`),
      ].join("\n"),
    );
  }

  // Generate and download ZIP
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fiches_${new Date().toISOString().split("T")[0]}.zip`;
  a.click();
  URL.revokeObjectURL(url);

  return { total: fiches.length, succeeded, failed };
}
