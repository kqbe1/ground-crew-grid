import { supabase } from "@/integrations/supabase/client";

const BUCKET = "quote-assets";

/** A stored reference is either a legacy http(s) URL or a Storage path. */
function isHttpRef(ref: string) {
  return ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("data:");
}

/**
 * Resolve one stored reference (Storage path or legacy URL) into a usable URL.
 * Returns null when the file cannot be resolved (missing/expired) — never throws.
 */
export async function resolveQuoteAssetUrl(ref: string): Promise<string | null> {
  if (!ref) return null;
  if (isHttpRef(ref)) return ref;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ref, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/** Resolve a list of references, silently dropping the ones that fail. */
export async function resolveQuoteAssetUrls(refs: unknown): Promise<string[]> {
  if (!Array.isArray(refs) || refs.length === 0) return [];
  const out = await Promise.all(refs.map((r) => resolveQuoteAssetUrl(String(r))));
  return out.filter((u): u is string => !!u);
}

/** Fetch a quote asset and return it as a base64 data URL (for jsPDF). */
export async function quoteAssetToDataUrl(ref: string): Promise<string | null> {
  const url = await resolveQuoteAssetUrl(ref);
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
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

/**
 * Returns a copy of the quote where photos / plan_photos are inlined as
 * base64 data URLs so jsPDF can embed them. Unresolvable files are dropped.
 */
export async function withQuotePdfPhotos(quote: any): Promise<any> {
  if (!quote) return quote;
  const inline = async (list: unknown) => {
    if (!Array.isArray(list) || list.length === 0) return [];
    const out = await Promise.all(list.map((p: any) => quoteAssetToDataUrl(String(p))));
    return out.filter(Boolean) as string[];
  };
  const [photos, planPhotos] = await Promise.all([inline(quote.photos), inline(quote.plan_photos)]);
  return { ...quote, photos, plan_photos: planPhotos };
}
