import { createClient } from "@/lib/supabase/server";
import { runPostDetailsScraper, type ScrapedReel } from "@/lib/apify";
import { saveThumbnailPermanently, saveAvatarPermanently } from "@/lib/reel-thumbnail";

function captionText(caption: ScrapedReel["caption"]): string | null {
  if (!caption) return null;
  if (typeof caption === "string") return caption;
  return caption.text ?? null;
}

export function extractShortCode(url: string): string | null {
  const match = url.match(/\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

// Inserts a pending queue row for `rawUrl`, then runs the same single-reel
// Apify pull used by "Analyze reels by URL" so the row already has real
// stats/length/a permanent thumbnail by the time anyone looks at the Queue.
export async function queueAndAnalyzeReel(
  rawUrl: string,
): Promise<{ id: string; status: "ready" | "error"; error?: string }> {
  const shortCode = extractShortCode(rawUrl);
  const canonicalUrl = shortCode ? `https://www.instagram.com/p/${shortCode}/` : rawUrl;

  const supabase = await createClient();
  const { data: queued, error: insertError } = await supabase
    .from("ct_reel_queue")
    .insert({ url: canonicalUrl, short_code: shortCode, status: "pending" })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  try {
    const [item] = await runPostDetailsScraper({ postUrls: [canonicalUrl] });
    if (!item) throw new Error("Apify returned no data for this reel");

    const [permanentThumbnail, permanentAvatar] = await Promise.all([
      saveThumbnailPermanently(item.thumbnail_url, item.code ?? shortCode),
      saveAvatarPermanently(item.user?.profile_pic_url, item.user?.username),
    ]);

    const { error: updateError } = await supabase
      .from("ct_reel_queue")
      .update({
        status: "ready",
        caption: captionText(item.caption),
        thumbnail_url: permanentThumbnail ?? item.thumbnail_url ?? null,
        video_url: item.video_url ?? null,
        owner_username: item.user?.username ?? null,
        owner_avatar_url: permanentAvatar ?? item.user?.profile_pic_url ?? null,
        posted_at: item.taken_at_date ?? null,
        views: item.metrics?.play_count ?? item.play_count ?? 0,
        likes: item.metrics?.like_count ?? item.like_count ?? 0,
        comments_count: item.metrics?.comment_count ?? item.comment_count ?? 0,
        shares_count: item.metrics?.share_count ?? item.share_count ?? null,
        duration_seconds: item.video_duration ?? null,
      })
      .eq("id", queued.id);

    if (updateError) throw new Error(updateError.message);
    return { id: queued.id, status: "ready" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    await supabase
      .from("ct_reel_queue")
      .update({ status: "error", error_message: message })
      .eq("id", queued.id);
    return { id: queued.id, status: "error", error: message };
  }
}
