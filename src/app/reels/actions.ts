"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runPostDetailsScraper, type ScrapedReel } from "@/lib/apify";

export async function deleteReels(reelIds: string[], batchId?: string) {
  if (reelIds.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("ct_reels").delete().in("id", reelIds);
  if (error) throw new Error(error.message);

  revalidatePath("/reels");
  revalidatePath("/research");
  if (batchId) revalidatePath(`/research/${batchId}`);
}

export type ReelStatsEdit = {
  views: number;
  likes: number;
  commentsCount: number;
  sharesCount: number | null;
};

export async function updateReelStats(
  reelId: string,
  stats: ReelStatsEdit,
  batchId?: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_reels")
    .update({
      views: stats.views,
      likes: stats.likes,
      comments_count: stats.commentsCount,
      shares_count: stats.sharesCount,
    })
    .eq("id", reelId);

  if (error) throw new Error(error.message);

  revalidatePath("/reels");
  revalidatePath("/research");
  revalidatePath(`/research/reel/${reelId}`);
  if (batchId) revalidatePath(`/research/${batchId}`);
}

function captionText(caption: ScrapedReel["caption"]): string | null {
  if (!caption) return null;
  if (typeof caption === "string") return caption;
  return caption.text ?? null;
}

export type RepullResult = { updated: number; failed: string[] };

// Refreshes stats/length/caption/thumbnail for reels that are already saved,
// matched by URL. Deliberately leaves transcript/transcription_status
// untouched - re-running the "match against learnwith_sources" logic used
// for brand-new reels would silently blank out a transcript that was added
// here directly (e.g. via the Transcribe button) if that lookup doesn't
// happen to find a match this time around.
export async function repullReels(urls: string[]): Promise<RepullResult> {
  if (urls.length === 0) return { updated: 0, failed: [] };

  const items = await runPostDetailsScraper({ postUrls: urls });
  const supabase = await createClient();

  let updated = 0;
  const failed: string[] = [];

  for (const item of items) {
    const url = item.code ? `https://www.instagram.com/p/${item.code}/` : null;
    if (!url) continue;

    const { error } = await supabase
      .from("ct_reels")
      .update({
        caption: captionText(item.caption),
        thumbnail_url: item.thumbnail_url ?? null,
        video_url: item.video_url ?? null,
        owner_username: item.user?.username ?? null,
        posted_at: item.taken_at_date ?? null,
        views: item.metrics?.play_count ?? item.play_count ?? 0,
        likes: item.metrics?.like_count ?? item.like_count ?? 0,
        comments_count: item.metrics?.comment_count ?? item.comment_count ?? 0,
        shares_count: item.metrics?.repost_count ?? item.repost_count ?? null,
        duration_seconds: item.video_duration ?? null,
        // "Analyzed" on All Reels shows created_at - bumping it to now on
        // every repull is how the row shows up as just-refreshed there.
        created_at: new Date().toISOString(),
      })
      .eq("url", url);

    if (error) failed.push(url);
    else updated++;
  }

  revalidatePath("/reels");
  revalidatePath("/research");
  return { updated, failed };
}
