"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  runProfileReelsScraper,
  runPostDetailsScraper,
  type ScrapedReel,
} from "@/lib/apify";
import { autoAnalyzeReel } from "@/lib/reel-analysis";

export async function dismissBatchWarning(
  batchId: string,
  field: "incomplete" | "window",
) {
  const supabase = await createClient();
  const column = field === "incomplete" ? "dismissed_incomplete_warning" : "dismissed_window_warning";
  const { error } = await supabase
    .from("ct_research_batches")
    .update({ [column]: true })
    .eq("id", batchId);

  if (error) throw new Error(error.message);
  revalidatePath("/research");
  revalidatePath(`/research/${batchId}`);
}

function captionText(caption: ScrapedReel["caption"]): string | null {
  if (!caption) return null;
  if (typeof caption === "string") return caption;
  return caption.text ?? null;
}

function toReelRow(item: ScrapedReel, batchId: string) {
  return {
    batch_id: batchId,
    instagram_id: item.id ?? null,
    short_code: item.code ?? null,
    url: item.code ? `https://www.instagram.com/p/${item.code}/` : "",
    caption: captionText(item.caption),
    thumbnail_url: item.thumbnail_url ?? null,
    video_url: item.video_url ?? null,
    owner_username: item.user?.username ?? null,
    posted_at: item.taken_at_date ?? null,
    views: item.metrics?.play_count ?? item.play_count ?? 0,
    likes: item.metrics?.like_count ?? item.like_count ?? 0,
    comments_count: item.metrics?.comment_count ?? item.comment_count ?? 0,
    shares_count: item.metrics?.share_count ?? item.share_count ?? null,
  };
}

const MAX_RESULTS_LIMIT = 500;

export async function runProfileResearch(formData: FormData) {
  const profileUrl = String(formData.get("profileUrl") ?? "").trim();
  const resultsLimitRaw = String(formData.get("resultsLimit") ?? "").trim();
  // Blank means "no cap" - only meaningful with a date range (see below).
  // Without a date range there's nothing else bounding the pull, so blank
  // there still falls back to a sane default of 30.
  const resultsLimit = resultsLimitRaw
    ? Math.min(Math.max(Number(resultsLimitRaw) || 1, 1), MAX_RESULTS_LIMIT)
    : null;
  const dateFrom = String(formData.get("dateFrom") ?? "").trim() || null;
  const dateTo = String(formData.get("dateTo") ?? "").trim() || null;

  if (!profileUrl) throw new Error("Instagram profile URL is required");

  const username = profileUrl
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/.*$/, "")
    .trim();

  // This actor has no native date filter - it returns the N most recent
  // reels, and we filter by date afterward. If a date range is set, the
  // requested pool size isn't enough to guarantee we search back far
  // enough to reach it (e.g. a daily poster needs ~18 fetched reels to
  // cover an 18-day window, not the 10 the user may have typed). So when
  // a date range is present, always fetch as deep as our safety cap
  // allows rather than capping the raw fetch at the user's typed number.
  const hasDateRange = Boolean(dateFrom || dateTo);
  const fetchLimit = hasDateRange ? MAX_RESULTS_LIMIT : resultsLimit ?? 30;

  const items = await runProfileReelsScraper({
    username,
    maxResults: fetchLimit,
  });

  const earliestFetchedAt = items.reduce<string | null>((earliest, item) => {
    if (!item.taken_at_date) return earliest;
    if (!earliest || item.taken_at_date < earliest) return item.taken_at_date;
    return earliest;
  }, null);

  const dateFiltered = items
    .filter((item) => {
      if (!item.taken_at_date) return true;
      if (dateFrom && item.taken_at_date < `${dateFrom}T00:00:00`) return false;
      if (dateTo && item.taken_at_date > `${dateTo}T23:59:59`) return false;
      return true;
    })
    // Within a date range, sort by views (not recency) so capping to a
    // requested count - when one is given - can't cut out an older top
    // performer. That was the exact bug that caused a 1.2M-view reel to
    // go missing in the first place.
    .sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0));

  // With a date range and no explicit cap, keep every reel found in the
  // window - "pull everything from that date range" is the whole point of
  // setting dates without also typing a count. Without a date range,
  // resultsLimit is the pull itself, so it still applies (default 30).
  const filtered =
    hasDateRange && resultsLimit == null
      ? dateFiltered
      : dateFiltered.slice(0, resultsLimit ?? 30);

  const effectiveResultsLimit = hasDateRange ? resultsLimit : resultsLimit ?? 30;

  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase
    .from("ct_research_batches")
    .insert({
      kind: "profile",
      input_value: profileUrl,
      date_from: dateFrom,
      date_to: dateTo,
      results_limit: effectiveResultsLimit,
      raw_fetch_count: items.length,
      earliest_fetched_at: earliestFetchedAt,
      creator_username: items.find((i) => i.user?.username)?.user?.username ?? null,
      creator_avatar_url:
        items.find((i) => i.user?.profile_pic_url)?.user?.profile_pic_url ?? null,
    })
    .select("id")
    .single();

  if (batchError) throw new Error(batchError.message);

  // Don't truncate the filtered set further - a hard cap by recency could
  // cut out an older, better-performing reel that's still inside the
  // window. The results table is sortable, so show everything that
  // qualifies and let the user find the top performers themselves.
  const rows = filtered.map((item) => toReelRow(item, batch.id));

  if (rows.length > 0) {
    const { error: reelsError } = await supabase.from("ct_reels").insert(rows);
    if (reelsError) throw new Error(reelsError.message);
  }

  redirect(`/research/${batch.id}`);
}

// A short code (e.g. "DVC04c4EXCF") is the one stable identifier shared
// across every URL shape Instagram/the transcription tool might store
// (/p/, /reel/, /reels/, with a username prefix, with a query string...),
// so matching on it is far more reliable than comparing full URLs.
function extractShortCode(url: string): string | null {
  const match = url.match(/\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

export async function analyzeSingleReel(formData: FormData) {
  const reelUrls = String(formData.get("reelUrl") ?? "")
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);
  if (reelUrls.length === 0) throw new Error("At least one reel URL is required");

  const items = await runPostDetailsScraper({ postUrls: reelUrls });

  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase
    .from("ct_research_batches")
    .insert({
      kind: "single_reel",
      input_value: reelUrls.length === 1 ? reelUrls[0] : `${reelUrls.length} reels`,
      creator_username: items.find((i) => i.user?.username)?.user?.username ?? null,
      creator_avatar_url:
        items.find((i) => i.user?.profile_pic_url)?.user?.profile_pic_url ?? null,
    })
    .select("id")
    .single();

  if (batchError) throw new Error(batchError.message);

  const rows = items.map((item) => toReelRow(item, batch.id));

  // Reuse an existing transcript from the transcription tool when one's
  // already there, instead of re-transcribing something already done.
  const shortCodes = rows.map((r) => r.short_code).filter((c): c is string => Boolean(c));
  const transcriptByShortCode = new Map<string, string>();

  if (shortCodes.length > 0) {
    const orFilter = shortCodes.map((c) => `origin.ilike.%${c}%`).join(",");
    const { data: sources } = await supabase
      .from("learnwith_sources")
      .select("origin, transcript, status, created_at")
      .eq("status", "ready")
      .not("transcript", "is", null)
      .or(orFilter)
      .order("created_at", { ascending: false });

    for (const code of shortCodes) {
      const match = sources?.find((s) => s.origin?.includes(code));
      if (match?.transcript) transcriptByShortCode.set(code, match.transcript);
    }
  }

  const rowsWithTranscripts = rows.map((row) => {
    const transcript = row.short_code ? transcriptByShortCode.get(row.short_code) : undefined;
    if (!transcript) return row;
    return {
      ...row,
      transcript,
      transcription_status: "ready",
    };
  });

  if (rowsWithTranscripts.length > 0) {
    const { data: inserted, error: reelsError } = await supabase
      .from("ct_reels")
      .insert(rowsWithTranscripts)
      .select("id, transcript, transcription_status");
    if (reelsError) throw new Error(reelsError.message);

    const readyIds = (inserted ?? [])
      .filter((r) => r.transcription_status === "ready" && r.transcript)
      .map((r) => r.id);
    await Promise.allSettled(readyIds.map((id) => autoAnalyzeReel(id)));
  }

  redirect(`/research/${batch.id}`);
}
