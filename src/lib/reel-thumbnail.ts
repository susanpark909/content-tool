import { createClient } from "@/lib/supabase/server";

// Instagram's CDN links (thumbnails, avatars) expire after about a week (the
// `oe=` param is a hex Unix timestamp). Downloading the image once at pull
// time and re-hosting it in Supabase Storage means it never breaks. Fails
// soft - an image hiccup should never block saving the reel's actual stats.
async function savePermanentImage(
  sourceUrl: string,
  bucket: string,
  path: string,
): Promise<string | null> {
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await response.arrayBuffer());

    const supabase = await createClient();
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: true });

    if (error) return null;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export async function saveThumbnailPermanently(
  instagramThumbnailUrl: string | null | undefined,
  shortCode: string | null | undefined,
): Promise<string | null> {
  if (!instagramThumbnailUrl || !shortCode) return null;
  return savePermanentImage(instagramThumbnailUrl, "reel-thumbnails", `${shortCode}.jpg`);
}

export async function saveAvatarPermanently(
  instagramAvatarUrl: string | null | undefined,
  ownerUsername: string | null | undefined,
): Promise<string | null> {
  if (!instagramAvatarUrl || !ownerUsername) return null;
  return savePermanentImage(instagramAvatarUrl, "creator-avatars", `${ownerUsername}.jpg`);
}

// Carousel slides get the same treatment as thumbnails: saved once, so they never expire.
export async function saveSlidePermanently(
  instagramImageUrl: string | null | undefined,
  shortCode: string | null | undefined,
  index: number,
): Promise<string | null> {
  if (!instagramImageUrl || !shortCode) return null;
  return savePermanentImage(instagramImageUrl, "reel-thumbnails", `${shortCode}-s${index + 1}.jpg`);
}
