import { supabase } from "@/integrations/supabase/client";

export type PdfDocumentType = "fiche_intervention" | "fiche_entretien" | "devis";

/**
 * Detect the right document type from an intervention sheet.
 */
export function ficheDocumentType(sheet: any): PdfDocumentType {
  return sheet?.entretien_type ? "fiche_entretien" : "fiche_intervention";
}

/**
 * Fetch the PDF config for the current company + document type, falling back
 * to the fiche_intervention row, then to any row, to stay backward compatible.
 */
export async function fetchPdfConfig(documentType: PdfDocumentType) {
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

  let row: any = null;
  if (companyId) {
    const { data } = await supabase
      .from("pdf_settings")
      .select("*")
      .eq("company_id", companyId)
      .eq("document_type", documentType)
      .maybeSingle();
    row = data;
    if (!row) {
      const { data: fallback } = await supabase
        .from("pdf_settings")
        .select("*")
        .eq("company_id", companyId)
        .eq("document_type", "fiche_intervention")
        .maybeSingle();
      row = fallback;
    }
  }
  if (!row) {
    const { data: any1 } = await supabase
      .from("pdf_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    row = any1;
  }
  return row;
}

/**
 * Convert a stored logo path to a base64 data URL for jsPDF.
 * The company-assets bucket is public, so we use the public URL.
 */
export async function fetchLogoDataUrl(logoPath: string | null | undefined): Promise<string | null> {
  if (!logoPath) return null;
  try {
    const { data } = supabase.storage.from("company-assets").getPublicUrl(logoPath);
    const url = data?.publicUrl;
    if (!url) return null;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function loadPdfConfigAndLogo(documentType: PdfDocumentType) {
  const pdfCfg = await fetchPdfConfig(documentType);
  const logoDataUrl = await fetchLogoDataUrl(pdfCfg?.logo_url ?? null);
  return { pdfCfg, logoDataUrl };
}