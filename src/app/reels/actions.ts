"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runPostDetailsScraper, type ScrapedReel } from "@/lib/apify";
import { saveThumbnailPermanently, saveAvatarPermanently } from "@/lib/reel-thumbnail";

export type ReelGoal = "views" | "shares" | "comments" | "saves";

// A reel can have more than one goal (Views, Shares, Comments).
export async function setReelGoals(reelId: string, goals: ReelGoal[]) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_reels").update({ goals }).eq("id", reelId);
  if (error) throw new Error(error.message);

  revalidatePath("/reels");
  revalidatePath(`/analyze-reel/reel/${reelId}`);
}

export async function setReelGoalsBulk(reelIds: string[], goals: ReelGoal[]) {
  if (reelIds.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("ct_reels").update({ goals }).in("id", reelIds);
  if (error) throw new Error(error.message);

  revalidatePath("/reels");
}

// Takes a reel off the New row only. It stays in All Reels.
export async function dismissFromNew(reelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_reels").update({ dismissed_from_new: true }).eq("id", reelId);
  if (error) throw new Error(error.message);
  revalidatePath("/reels");
}

export async function deleteReels(reelIds: string[], batchId?: string) {
  if (reelIds.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("ct_reels").delete().in("id", reelIds);
  if (error) throw new Error(error.message);

  revalidatePath("/reels");
  revalidatePath("/analyze-reel");
  if (batchId) revalidatePath(`/analyze-reel/${batchId}`);
}

export type ReelStatsEdit = {
  views: number;
  likes: number;
  commentsCount: number;
  sharesCount?: number | null;
  repostsCount?: number | null;
  savesCount?: number | null;
};

export async function updateReelStats(
  reelId: string,
  stats: ReelStatsEdit,
  batchId?: string,
) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ct_reels")
    .update({
      views: stats.views,
      likes: stats.likes,
      comments_count: stats.commentsCount,
      ...(stats.sharesCount !== undefined ? { shares_count: stats.sharesCount } : {}),
      ...(stats.repostsCount !== undefined ? { reposts_count: stats.repostsCount } : {}),
      ...(stats.savesCount !== undefined ? { saves_count: stats.savesCount } : {}),
      // "Analyzed" on All Reels shows created_at - editing the numbers by hand
      // moves it to today. manually_edited_at gets the same moment, which is how
      // the New section knows this wasn't a fresh analysis.
      created_at: now,
      manually_edited_at: now,
    })
    .eq("id", reelId);

  if (error) throw new Error(error.message);

  revalidatePath("/reels");
  revalidatePath("/analyze-reel");
  revalidatePath(`/analyze-reel/reel/${reelId}`);
  if (batchId) revalidatePath(`/analyze-reel/${batchId}`);
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

  await Promise.all(
    items.map(async (item) => {
    const url = item.code ? `https://www.instagram.com/p/${item.code}/` : null;
    if (!url) return;

    const [permanentThumbnail, permanentAvatar] = await Promise.all([
      saveThumbnailPermanently(item.thumbnail_url, item.code),
      saveAvatarPermanently(item.user?.profile_pic_url, item.user?.username),
    ]);

    const { error } = await supabase
      .from("ct_reels")
      .update({
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
        reposts_count: item.metrics?.repost_count ?? item.repost_count ?? null,
        saves_count: item.metrics?.save_count ?? item.save_count ?? null,
        duration_seconds: item.video_duration ?? null,
        // "Analyzed" on All Reels shows created_at - bumping it to now on
        // every repull is how the row shows up as just-refreshed there.
        created_at: new Date().toISOString(),
        dismissed_from_new: false,
      })
      .eq("url", url);

    if (error) failed.push(url);
    else updated++;
    }),
  );

  revalidatePath("/reels");
  revalidatePath("/analyze-reel");
  return { updated, failed };
}

// The long texts (full transcript, hook, body, call to action) aren't kept in the Library list.
// They're fetched only when you press Download, for exactly the posts you filtered to.
export async function getExportTexts(ids: string[]) {
  const supabase = await createClient();
  const out: Record<string, { transcript: string; hook: string; body: string; cta: string }> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("ct_reels")
      .select("id, transcript, hook_text, body_text, cta_text")
      .in("id", ids.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      out[r.id as string] = {
        transcript: String(r.transcript ?? ""),
        hook: String(r.hook_text ?? ""),
        body: String(r.body_text ?? ""),
        cta: String(r.cta_text ?? ""),
      };
    }
  }
  return out;
}

// The Library search looks through everything written about a post: caption, hook, body, call to action,
// the full transcript and the creator's name. The long texts aren't kept in the list, so the database does the looking.
export async function searchReelText(text: string): Promise<string[]> {
  const q = text.trim().replace(/[%_\,()]/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 2) return [];
  const supabase = await createClient();
  const ids: string[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await supabase
      .from("ct_reels")
      .select("id")
      .or(["caption", "hook_text", "body_text", "cta_text", "transcript", "owner_username"].map((c) => `${c}.ilike.%${q}%`).join(","))
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    ids.push(...(data ?? []).map((r) => r.id as string));
    if (!data || data.length < 1000) break;
  }
  return ids;
}
