import { supabase } from "@/integrations/supabase/client";

/**
 * Converts a data URL / base64 string to a standard binary Blob
 */
function dataURItoBlob(dataURI: string): Blob {
  const arr = dataURI.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Uploads prescription drawing / canvas image(s) to Supabase Storage bucket 'prescriptions'
 * and returns the lightweight CDN public URL(s).
 * 
 * Safe Fallback: If upload fails for any reason, returns the original image string so
 * prescription saving is NEVER blocked and data is NEVER lost.
 */
export async function uploadPrescriptionImage(
  imageData: string | null,
  clinicId: string = 'global',
  visitId: string
): Promise<string | null> {
  if (!imageData) return null;

  // If already a hosted URL or plain text advice, no upload needed
  if (!imageData.startsWith('data:image') && !imageData.startsWith('[')) {
    return imageData;
  }

  try {
    // 1. Handle Multi-page JSON array string: '["data:image/png...", "data:image/png..."]'
    if (imageData.startsWith('[')) {
      try {
        const parsed = JSON.parse(imageData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const uploadedUrls: string[] = [];
          for (let i = 0; i < parsed.length; i++) {
            const pageItem = parsed[i];
            if (typeof pageItem === 'string' && pageItem.startsWith('data:image')) {
              const blob = dataURItoBlob(pageItem);
              const ext = pageItem.includes('image/webp') ? 'webp' : 'png';
              const filePath = `${clinicId}/${visitId}_page_${i}_${Date.now()}.${ext}`;

              const { error: uploadError } = await supabase.storage
                .from('prescriptions')
                .upload(filePath, blob, {
                  contentType: blob.type,
                  upsert: true
                });

              if (uploadError) {
                console.warn(`[PrescriptionStorage] Upload failed for page ${i}:`, uploadError.message);
                uploadedUrls.push(pageItem); // fallback to original
              } else {
                const { data } = supabase.storage.from('prescriptions').getPublicUrl(filePath);
                uploadedUrls.push(data.publicUrl);
              }
            } else {
              uploadedUrls.push(pageItem);
            }
          }
          return JSON.stringify(uploadedUrls);
        }
      } catch {
        // Not a valid JSON array, fallback to single image handler
      }
    }

    // 2. Handle Single base64 image: "data:image/png;base64,..."
    if (imageData.startsWith('data:image')) {
      const blob = dataURItoBlob(imageData);
      const ext = imageData.includes('image/webp') ? 'webp' : 'png';
      const filePath = `${clinicId}/${visitId}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('prescriptions')
        .upload(filePath, blob, {
          contentType: blob.type,
          upsert: true
        });

      if (uploadError) {
        console.warn("[PrescriptionStorage] Upload failed, falling back to database storage:", uploadError.message);
        return imageData;
      }

      const { data } = supabase.storage.from('prescriptions').getPublicUrl(filePath);
      return data.publicUrl;
    }

    return imageData;
  } catch (err) {
    console.warn("[PrescriptionStorage] Error during prescription image upload:", err);
    return imageData; // Zero data loss guarantee
  }
}
