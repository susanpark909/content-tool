import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCheapPost } from "@/lib/cheap-post";
import { saveThumbnailPermanently } from "@/lib/reel-thumbnail";
import { fetchPublicReelInfo } from "@/lib/instagram-public";

// The cheap first look runs after the response, so a shared link is saved instantly.
function scheduleCheapLook(queueId: string, url: string, shortCode: string | null, looksLikeReel = false, owner: string | null = null) {
  after(async () => {
    const supabase = await createClient();
    const post = await fetchCheapPost(url, looksLikeReel, owner);
    if (!post) return;
    const thumb = post.thumbnailUrl ? await saveThumbnailPermanently(post.thumbnailUrl, shortCode) : null;
    await supabase
      .from("ct_reel_queue")
      .update({
        post_type: post.postType,
        views: post.views,
        likes: post.likes,
        comments_count: post.comments,
        duration_seconds: post.durationSeconds,
        ...(post.caption ? { caption: post.caption } : {}),
        ...(post.owner ? { owner_username: post.owner } : {}),
        ...(post.postedAt ? { posted_at: post.postedAt } : {}),
        ...(thumb || post.thumbnailUrl ? { thumbnail_url: thumb ?? post.thumbnailUrl } : {}),
      })
      .eq("id", queueId);
  });
}

export function extractShortCode(url: string): string | null {
  const match = url.match(/\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

// Saves a reel link to the Queue straight away, then fills it in. First the free preview info (creator,
// caption, posted date, thumbnail) off Instagram's public page; then, in the background, one cheap scraper
// look for the public numbers (views, likes, comments, length). Shares, saves and reposts, and the
// transcript, only come later, when you press Analyze on the row.
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
  const { data: inQueue } = await supabase.from("ct_reel_queue").select("id, views, post_type").eq("url", canonicalUrl).maybeSingle();
  if (inQueue) {
    // a link saved before the numbers were fetched gets them now
    if (inQueue.post_type == null) scheduleCheapLook(inQueue.id as string, canonicalUrl, shortCode);
    return { id: inQueue.id as string, status: "ready", note: "Already in the Queue" };
  }

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

  scheduleCheapLook(queued.id as string, canonicalUrl, shortCode, rawUrl.includes("/reel/") || rawUrl.includes("/reels/"), info?.username ?? null);

  return { id: queued.id as string, status: "ready" };
}
