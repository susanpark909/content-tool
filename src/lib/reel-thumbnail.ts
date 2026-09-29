import { createClient } from "@/lib/supabase/server";

// Instagram's CDN thumbnail links expire after about a week (the `oe=`
// param is a hex Unix timestamp). Downloading the image once at pull time
// and re-hosting it in Supabase Storage means it never breaks. Fails soft -
// a thumbnail hiccup should never block saving the reel's actual stats.
export async function saveThumbnailPermanently(
  instagramThumbnailUrl: string | null | undefined,
  shortCode: string | null | undefined,
): Promise<string | null> {
  if (!instagramThumbnailUrl || !shortCode) return null;

  try {
    const response = await fetch(instagramThumbnailUrl);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await response.arrayBuffer());

    const supabase = await createClient();
    const path = `${shortCode}.jpg`;
    const { error } = await supabase.storage
      .from("reel-thumbnails")
      .upload(path, bytes, { contentType, upsert: true });

    if (error) return null;

    const { data } = supabase.storage.from("reel-thumbnails").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}
