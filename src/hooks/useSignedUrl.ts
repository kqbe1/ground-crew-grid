import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Given a storage path or signed URL, return a fresh signed URL.
 * If the input is already a valid http URL with a non-expired token, it's used as-is for the first render,
 * then refreshed in background.
 */
function extractPathFromSignedUrl(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    // Pattern: /storage/v1/object/sign/<bucket>/<path>
    const match = u.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)/);
    if (match) return { bucket: match[1], path: decodeURIComponent(match[2]) };

    // Pattern: /storage/v1/object/public/<bucket>/<path>
    const pubMatch = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (pubMatch) return { bucket: pubMatch[1], path: decodeURIComponent(pubMatch[2]) };
  } catch {}
  return null;
}

export function useSignedUrls(urls: string[], bucket?: string): string[] {
  const [signed, setSigned] = useState<string[]>(urls);

  useEffect(() => {
    if (!urls || urls.length === 0) { setSigned([]); return; }

    let cancelled = false;

    (async () => {
      const results: string[] = [];
      for (const url of urls) {
        if (!url) { results.push(""); continue; }

        // If it's a base64 data URL, keep it
        if (url.startsWith("data:")) { results.push(url); continue; }

        // Try to extract bucket/path from a previously signed URL
        const extracted = extractPathFromSignedUrl(url);
        if (extracted) {
          const { data } = await supabase.storage.from(extracted.bucket).createSignedUrl(extracted.path, 3600);
          results.push(data?.signedUrl || url);
        } else if (url.startsWith("http")) {
          // Already a full URL (possibly public), use as-is
          results.push(url);
        } else {
          // Raw path - sign it with provided bucket or default
          const b = bucket || "intervention-photos";
          const { data } = await supabase.storage.from(b).createSignedUrl(url, 3600);
          results.push(data?.signedUrl || url);
        }
      }
      if (!cancelled) setSigned(results);
    })();

    return () => { cancelled = true; };
  }, [JSON.stringify(urls), bucket]);

  return signed;
}
