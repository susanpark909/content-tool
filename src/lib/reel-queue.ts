import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCheapPost } from "@/lib/cheap-post";
import { runPostDetailsScraper, postTypeOf } from "@/lib/apify";
import { saveThumbnailPermanently } from "@/lib/reel-thumbnail";
import { fetchPublicReelInfo } from "@/lib/instagram-public";
import { getCreatorAvatar } from "@/lib/creator-avatar";

// The cheap first look runs after the response, so a shared link is saved instantly.
function scheduleCheapLook(queueId: string, url: string, shortCode: string | null, looksLikeReel = false, owner: string | null = null) {
  after(async () => {
    const supabase = await createClient();
    // the full lookup first: it has shares as well as views, likes, comments and length. If it fails, the cheaper look still fills in the basics.
    let full: Awaited<ReturnType<typeof runPostDetailsScraper>>[number] | null = null;
    try {
      full = (await runPostDetailsScraper({ postUrls: [url] }))[0] ?? null;
    } catch {}
    if (full && !full.partial) {
      const m = full.metrics;
      const type = postTypeOf(full);
      const thumbFull = full.thumbnail_url ? await saveThumbnailPermanently(full.thumbnail_url, shortCode) : null;
      const cap = typeof full.caption === "string" ? full.caption : (full.caption?.text ?? null);
      await supabase
        .from("ct_reel_queue")
        .update({
          post_type: type,
          views: m?.play_count ?? full.play_count ?? null,
          likes: m?.like_count ?? full.like_count ?? null,
          comments_count: m?.comment_count ?? full.comment_count ?? null,
          shares_count: m?.share_count ?? full.share_count ?? null,
          reposts_count: m?.repost_count ?? full.repost_count ?? null,
          saves_count: m?.save_count ?? full.save_count ?? null,
          duration_seconds: full.video_duration ?? null,
          ...(full.video_url ? { video_url: full.video_url } : {}),
          ...(cap ? { caption: cap } : {}),
          ...(full.user?.username ? { owner_username: full.user.username } : {}),
          ...(full.taken_at_date ? { posted_at: full.taken_at_date } : {}),
          ...(thumbFull || full.thumbnail_url ? { thumbnail_url: thumbFull ?? full.thumbnail_url } : {}),
        })
        .eq("id", queueId);
      return;
    }
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
    const avatar = await getCreatorAvatar(supabase, info.username).catch(() => null);
    await supabase
      .from("ct_reel_queue")
      .update({
        caption: info.caption,
        owner_username: info.username,
        ...(avatar ? { owner_avatar_url: avatar } : {}),
        posted_at: info.postedAt,
        thumbnail_url: thumbnail ?? info.thumbnailUrl ?? null,
      })
      .eq("id", queued.id);
  }

  scheduleCheapLook(queued.id as string, canonicalUrl, shortCode, rawUrl.includes("/reel/") || rawUrl.includes("/reels/"), info?.username ?? null);

  return { id: queued.id as string, status: "ready" };
}
