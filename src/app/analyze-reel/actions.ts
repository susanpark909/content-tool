"use server";

import { revalidatePath } from "next/cache";
import { transcribeSelectedReels } from "./[batchId]/actions";
import { createClient } from "@/lib/supabase/server";
import {
  runProfileReelsScraper,
  runPostDetailsScraper,
  type ScrapedReel,
} from "@/lib/apify";
import { extractHookBodyCta } from "@/lib/reel-hook-extraction";
import { saveThumbnailPermanently, saveAvatarPermanently } from "@/lib/reel-thumbnail";

function captionText(caption: ScrapedReel["caption"]): string | null {
  if (!caption) return null;
  if (typeof caption === "string") return caption;
  return caption.text ?? null;
}

async function toReelRow(item: ScrapedReel, batchId: string) {
  const [permanentThumbnail, permanentAvatar] = await Promise.all([
    saveThumbnailPermanently(item.thumbnail_url, item.code),
    saveAvatarPermanently(item.user?.profile_pic_url, item.user?.username),
  ]);
  return {
    batch_id: batchId,
    instagram_id: item.id ?? null,
    short_code: item.code ?? null,
    url: item.code ? `https://www.instagram.com/p/${item.code}/` : "",
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
    scan_only: false,
    transcript: null as string | null,
    transcription_status: null as string | null,
  };
}

const MAX_RESULTS_LIMIT = 5000;

export async function runProfileResearch(formData: FormData): Promise<{ batchId: string | null; added: number; skipped: number }> {
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
  const fetchLimit = hasDateRange ? MAX_RESULTS_LIMIT : resultsLimit ?? MAX_RESULTS_LIMIT;

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
      : dateFiltered.slice(0, resultsLimit ?? MAX_RESULTS_LIMIT);

  const effectiveResultsLimit = resultsLimit;

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
  const rows = await Promise.all(filtered.map((item) => toReelRow(item, batch.id)));

  // Never save a duplicate: reels that are already in your database are left exactly as they are.
  const { data: already } = await supabase
    .from("ct_reels")
    .select("url")
    .in("url", rows.length > 0 ? rows.map((r) => r.url) : [""]);
  const have = new Set((already ?? []).map((r) => r.url as string));
  const fresh = rows.filter((r) => !have.has(r.url));
  const skipped = rows.length - fresh.length;

  if (fresh.length > 0) {
    const { error: reelsError } = await supabase.from("ct_reels").insert(fresh);
    if (reelsError) throw new Error(reelsError.message);
  } else {
    await supabase.from("ct_research_batches").delete().eq("id", batch.id);
  }

  revalidatePath("/analyze-reel");
  return { batchId: fresh.length > 0 ? (batch.id as string) : null, added: fresh.length, skipped };
}

// A short code (e.g. "DVC04c4EXCF") is the one stable identifier shared
// across every URL shape Instagram/the transcription tool might store
// (/p/, /reel/, /reels/, with a username prefix, with a query string...),
// so matching on it is far more reliable than comparing full URLs.
function extractShortCode(url: string): string | null {
  const match = url.match(/\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

// A reel is analyzed once it has the full numbers (shares/saves/reposts) or a transcript.
function isAnalyzed(r: { shares_count: number | null; reposts_count: number | null; saves_count: number | null; transcription_status: string | null }) {
  return r.shares_count != null || r.reposts_count != null || r.saves_count != null || r.transcription_status === "ready";
}

export async function checkExistingReelUrls(
  rawUrls: string[],
): Promise<{ url: string; shortCode: string }[]> {
  const canonicalByRaw = rawUrls
    .map((raw) => {
      const code = extractShortCode(raw);
      return code ? { raw, url: `https://www.instagram.com/p/${code}/`, code } : null;
    })
    .filter((x): x is { raw: string; url: string; code: string } => Boolean(x));

  if (canonicalByRaw.length === 0) return [];

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ct_reels")
    .select("url, shares_count, reposts_count, saves_count, transcription_status")
    .in(
      "url",
      canonicalByRaw.map((c) => c.url),
    );

  const existingUrls = new Set((existing ?? []).filter(isAnalyzed).map((r) => r.url));
  return canonicalByRaw
    .filter((c) => existingUrls.has(c.url))
    .map((c) => ({ url: c.url, shortCode: c.code }));
}

export async function analyzeSingleReel(
  formData: FormData,
): Promise<{ batchId: string | null; skipped?: number }> {
  const requested = String(formData.get("reelUrl") ?? "")
    .split(String.fromCharCode(10))
    .map((u) => u.trim())
    .filter(Boolean);
  if (requested.length === 0) throw new Error("At least one reel URL is required");

  const supabase = await createClient();

  // Skip anything already analyzed before spending any scraper credit.
  const doneUrls = new Set((await checkExistingReelUrls(requested)).map((d) => d.url));
  const reelUrls = requested.filter((u) => {
    const code = extractShortCode(u);
    return !(code && doneUrls.has(`https://www.instagram.com/p/${code}/`));
  });
  if (doneUrls.size > 0) {
    // Already pulled in full: no scraper credit, just make sure each one is transcribed.
    try {
      const { data: have } = await supabase.from("ct_reels").select("id").in("url", [...doneUrls]);
      const ids = (have ?? []).map((r) => r.id as string);
      if (ids.length > 0) await transcribeSelectedReels(ids);
    } catch {
      // the reel page keeps its Transcribe button as a backup
    }
  }
  if (reelUrls.length === 0) return { batchId: null, skipped: requested.length };

  const items = await runPostDetailsScraper({ postUrls: reelUrls });

  // Re-analyzing a URL that's already in ct_reels (e.g. to refresh stats or
  // pick up a transcript that wasn't ready yet) updates that existing row
  // in place instead of inserting a duplicate - keeps its id (so anything
  // already referencing it, like a saved hook, stays valid) and its
  // original batch. Only URLs that are genuinely new get a fresh batch.
  const candidateUrls = items
    .map((item) => (item.code ? `https://www.instagram.com/p/${item.code}/` : null))
    .filter((u): u is string => Boolean(u));
  const { data: existingReels } = await supabase
    .from("ct_reels")
    .select("id, url")
    .in("url", candidateUrls.length > 0 ? candidateUrls : [""]);
  const existingIdByUrl = new Map((existingReels ?? []).map((r) => [r.url, r.id]));

  const newItems = items.filter((item) => {
    const url = item.code ? `https://www.instagram.com/p/${item.code}/` : null;
    return url ? !existingIdByUrl.has(url) : false;
  });

  let batchId: string | null = null;
  if (newItems.length > 0) {
    const { data: batch, error: batchError } = await supabase
      .from("ct_research_batches")
      .insert({
        kind: "single_reel",
        input_value: reelUrls.length === 1 ? reelUrls[0] : `${reelUrls.length} reels`,
        creator_username: newItems.find((i) => i.user?.username)?.user?.username ?? null,
        creator_avatar_url:
          newItems.find((i) => i.user?.profile_pic_url)?.user?.profile_pic_url ?? null,
      })
      .select("id")
      .single();

    if (batchError) throw new Error(batchError.message);
    batchId = batch.id;
  }

  const rows = await Promise.all(items.map((item) => toReelRow(item, batchId ?? "")));

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
    const readyIds: string[] = [];

    for (const row of rowsWithTranscripts) {
      const existingId = existingIdByUrl.get(row.url);
      const { batch_id, transcript, transcription_status, ...rest } = row;
      void batch_id;
      const hasFreshTranscript = transcription_status === "ready" && transcript;

      if (existingId) {
        // Only touch transcript/transcription_status when this pass found a
        // fresh one - otherwise leave whatever's already saved on the
        // existing row alone. Unconditionally writing the null defaults
        // baked into toReelRow would silently blank out a transcript that
        // was added directly in this app (e.g. via the Transcribe button)
        // whenever the learnwith_sources match doesn't happen to hit again.
        const fields = hasFreshTranscript
          ? { ...rest, transcript, transcription_status }
          : rest;
        const { error: updateError } = await supabase
          .from("ct_reels")
          .update(fields)
          .eq("id", existingId);
        if (updateError) throw new Error(updateError.message);
        if (hasFreshTranscript) {
          readyIds.push(existingId);
        }
      } else {
        const { data: insertedRow, error: insertError } = await supabase
          .from("ct_reels")
          .insert(row)
          .select("id")
          .single();
        if (insertError) throw new Error(insertError.message);
        if (row.transcription_status === "ready" && row.transcript) {
          readyIds.push(insertedRow.id);
        }
      }
    }

    await Promise.allSettled(readyIds.map((id) => extractHookBodyCta(id)));

    // Analyze is the whole job: anything that still has no transcript starts transcribing now.
    try {
      const { data: saved } = await supabase
        .from("ct_reels")
        .select("id, transcript, transcription_status")
        .in("url", rowsWithTranscripts.map((r) => r.url));
      const needs = (saved ?? [])
        .filter((r) => !r.transcript && r.transcription_status !== "processing" && r.transcription_status !== "ready")
        .map((r) => r.id as string);
      if (needs.length > 0) await transcribeSelectedReels(needs);
    } catch {
      // the reel page keeps its Transcribe button as a backup
    }
  }

  revalidatePath("/analyze-reel");
  return { batchId, skipped: requested.length - reelUrls.length };
}
