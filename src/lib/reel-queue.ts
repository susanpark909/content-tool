import { createClient } from "@/lib/supabase/server";
import { saveThumbnailPermanently } from "@/lib/reel-thumbnail";
import { fetchPublicReelInfo } from "@/lib/instagram-public";

export function extractShortCode(url: string): string | null {
  const match = url.match(/\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

// Saves a reel link to the Queue WITHOUT running the paid scraper. It also
// tries to read the free preview info (creator, caption, posted date,
// thumbnail) off Instagram's public page; if that's blocked the row is just
// the link. Stats only get pulled later, when you press Analyze on the row.
export async function queueReelLink(
  rawUrl: string,
): Promise<{ id: string | null; status: "ready" | "error"; note?: string; error?: string }> {
  const shortCode = extractShortCode(rawUrl);
  const canonicalUrl = shortCode ? `https://www.instagram.com/p/${shortCode}/` : rawUrl;

  const supabase = await createClient();

  // Already analyzed? Then it's in All Reels - nothing to queue.
  const { data: inReels } = await supabase.from("ct_reels").select("id").eq("url", canonicalUrl).maybeSingle();
  if (inReels) return { id: null, status: "ready", note: "Already in All Reels" };

  // Already waiting in the queue? Don't add it twice.
  const { data: inQueue } = await supabase.from("ct_reel_queue").select("id").eq("url", canonicalUrl).maybeSingle();
  if (inQueue) return { id: inQueue.id as string, status: "ready", note: "Already in the Queue" };

  const { data: queued, error: insertError } = await supabase
    .from("ct_reel_queue")
    .insert({ url: canonicalUrl, short_code: shortCode, status: "ready" })
    .select("id")
    .single();
  if (insertError) return { id: null, status: "error", error: insertError.message };

  const info = await fetchPublicReelInfo(canonicalUrl);
  if (info) {
    const thumbnail = await saveThumbnailPermanently(info.thumbnailUrl, shortCode);
    await supabase
      .from("ct_reel_queue")
      .update({
        caption: info.caption,
        owner_username: info.username,
        posted_at: info.postedAt,
        thumbnail_url: thumbnail ?? info.thumbnailUrl ?? null,
      })
      .eq("id", queued.id);
  }

  return { id: queued.id as string, status: "ready" };
}
