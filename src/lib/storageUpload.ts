import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a base64 data-URL to a Supabase Storage bucket.
 * Returns the file path (not public URL) for use with signed URLs.
 */
export async function uploadBase64(
  bucket: "intervention-photos" | "intervention-signatures",
  base64DataUrl: string,
  userId: string,
): Promise<string> {
  // Extract mime and raw base64
  const match = base64DataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid base64 data URL");

  const mimeType = match[1];
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const raw = match[2];

  // Convert to Uint8Array
  const byteString = atob(raw);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }

  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const filePath = `${userId}/${id}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, bytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw error;

  // Return signed URL (1 hour TTL) instead of public URL
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 3600);

  if (!data?.signedUrl) throw new Error("Failed to create signed URL");
  return data.signedUrl;
}

/**
 * Upload multiple base64 photos to storage.
 * Returns array of signed URLs.
 */
export async function uploadPhotos(
  base64Photos: string[],
  userId: string,
): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of base64Photos) {
    // Skip if already a URL (not base64)
    if (photo.startsWith("http")) {
      urls.push(photo);
      continue;
    }
    const url = await uploadBase64("intervention-photos", photo, userId);
    urls.push(url);
  }
  return urls;
}

/**
 * Upload a signature data URL to storage.
 * Returns the signed URL.
 */
export async function uploadSignature(
  base64Signature: string,
  userId: string,
): Promise<string> {
  if (base64Signature.startsWith("http")) return base64Signature;
  return uploadBase64("intervention-signatures", base64Signature, userId);
}
