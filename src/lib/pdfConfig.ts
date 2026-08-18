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
    if (!row) {
      // Dernier recours : n'importe quelle config DE CETTE entreprise uniquement.
      const { data: anyOwn } = await supabase
        .from("pdf_settings")
        .select("*")
        .eq("company_id", companyId)
        .limit(1)
        .maybeSingle();
      row = anyOwn;
    }
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

/** Convert a storage path / signed URL / data URL into a base64 data URL usable by jsPDF. */
async function toDataUrl(ref: string, bucket = "intervention-photos"): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith("data:")) return ref;
  try {
    let url = ref;
    if (!ref.startsWith("http")) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(ref, 3600);
      if (!data?.signedUrl) return null;
      url = data.signedUrl;
    }
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

async function resolveList(list: any): Promise<string[]> {
  if (!Array.isArray(list) || list.length === 0) return [];
  const out = await Promise.all(list.map((p: string) => toDataUrl(p)));
  return out.filter(Boolean) as string[];
}

/**
 * Returns a copy of the sheet where every photo reference is inlined as a
 * base64 data URL, so jsPDF can actually embed the images in the PDF.
 */
export async function withPdfPhotos(sheet: any): Promise<any> {
  if (!sheet) return sheet;
  const [before, after, nameplate] = await Promise.all([
    resolveList(sheet.photos_before),
    resolveList(sheet.photos_after),
    resolveList(sheet.photos_nameplate),
  ]);
  return { ...sheet, photos_before: before, photos_after: after, photos_nameplate: nameplate };
}