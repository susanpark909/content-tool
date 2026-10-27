"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { transcribeSelectedReels } from "./[batchId]/actions";
import { createClient } from "@/lib/supabase/server";
import { profileUsername } from "@/lib/instagram-url";
import {
  runProfileReelsScraper,
  runPostDetailsScraper,
  slideUrlsOf,
  postTypeOf,
  type ScrapedReel,
  recoverFailedRun,
} from "@/lib/apify";
import { readCarouselSlides, persistSlides } from "@/lib/carousel-read";
import { pollTranscriptionsForUrls } from "@/lib/transcription-poll";
import { isNoAudioError } from "@/lib/transcription-state";
import { extractHookBodyCta } from "@/lib/reel-hook-extraction";
import { saveThumbnailPermanently, saveAvatarPermanently } from "@/lib/reel-thumbnail";
import { mapItem } from "@/lib/scan-providers";

function captionText(caption: ScrapedReel["caption"]): string | null {
  if (!caption) return null;
  if (typeof caption === "string") return caption;
  return caption.text ?? null;
}

// A post with no video isn't a reel: carousels and photos have nothing to transcribe.
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
    post_type: postTypeOf(item),
    ...(postTypeOf(item) === "carousel" && slideUrlsOf(item).length > 0 ? { slides: slideUrlsOf(item).map((url) => ({ url })) } : {}),
    created_at: new Date().toISOString(),
    transcript: null as string | null,
    transcription_status: null as string | null,
  };
}

// When a backup data source answered it has no shares, saves, reposts or video link. For a post already saved,
// leave those fields as they are instead of blanking them.
const PARTIAL_BLANKS = ["video_url", "shares_count", "reposts_count", "saves_count", "duration_seconds", "owner_avatar_url", "post_type", "slides"];
function withoutBlanks<T extends Record<string, unknown>>(row: T): T {
  const copy: Record<string, unknown> = { ...row };
  for (const k of PARTIAL_BLANKS) delete copy[k];
  return copy as T;
}

const MAX_RESULTS_LIMIT = 5000;

// Carousels come from a different (cheap) scraper than reels: it returns every kind of post, so we keep only the carousels
// that fall inside the date range and turn them into the same rows as reels.
async function pullCarouselRows(o: { username: string; dateFrom: string | null; dateTo: string | null; limit: number; batchId: string }) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return [];
  const res = await fetch(`https://api.apify.com/v2/acts/esdrasdw~instagram-content-scraper/run-sync-get-dataset-items?token=${token}&timeout=240`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [o.username],
      resultsType: "posts",
      resultsLimit: Math.min(Math.max(o.limit, 30), 1000),
      selectedFields: ["displayUrl", "title", "ownerUsername", "url", "timestamp", "likesCount", "commentsCount", "shortCode", "caption", "productType", "childPosts"],
    }),
  });
  let items: Record<string, unknown>[];
  if (res.ok) items = (await res.json()) as Record<string, unknown>[];
  else {
    const saved = await recoverFailedRun(await res.text(), token);
    if (!saved) throw new Error(`Couldn't pull carousels (${res.status})`);
    items = saved as Record<string, unknown>[];
  }
  const cars = items
    .map((i) => mapItem("esdrasdw", i, { kind: "carousels" }))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .filter((c) => {
      if (!c.postedAt) return true;
      const day = c.postedAt.slice(0, 10);
      if (o.dateFrom && day < o.dateFrom) return false;
      if (o.dateTo && day > o.dateTo) return false;
      return true;
    });
  // Every slide picture is saved permanently as the carousel is pulled in (Instagram's own links expire within days),
  // a few carousels at a time. A carousel whose slides are all saved counts as analyzed: there is nothing left to do.
  const out: Awaited<ReturnType<typeof buildOne>>[] = [];
  for (let i = 0; i < cars.length; i += 3) out.push(...(await Promise.all(cars.slice(i, i + 3).map(buildOne))));
  return out;

  async function buildOne(c: (typeof cars)[number]) {
      const thumb = await saveThumbnailPermanently(c.thumbnailUrl, c.code);
      const slides = c.slides.length > 0 ? await persistSlides(c.code, c.slides.map((url) => ({ url }))) : [];
      const saved = slides.length > 0 && slides.every((sl) => sl.url.includes("supabase.co"));
      return {
        batch_id: o.batchId,
        instagram_id: null as string | null,
        short_code: c.code,
        url: `https://www.instagram.com/p/${c.code}/`,
        caption: c.caption,
        thumbnail_url: thumb ?? c.thumbnailUrl,
        video_url: null as string | null,
        owner_username: c.owner ?? o.username,
        owner_avatar_url: null as string | null,
        posted_at: c.postedAt,
        views: 0,
        likes: c.likes,
        comments_count: c.comments,
        shares_count: null as number | null,
        reposts_count: null as number | null,
        saves_count: null as number | null,
        duration_seconds: null as number | null,
        scan_only: false,
        post_type: "carousel",
        ...(slides.length > 0 ? { slides } : {}),
        created_at: new Date().toISOString(),
        transcript: null as string | null,
        transcription_status: saved ? ("ready" as string | null) : (null as string | null),
      };
  }
}

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

  const username = profileUsername(profileUrl);

  // This actor has no native date filter - it returns the N most recent
  // reels, and we filter by date afterward. If a date range is set, the
  // requested pool size isn't enough to guarantee we search back far
  // enough to reach it (e.g. a daily poster needs ~18 fetched reels to
  // cover an 18-day window, not the 10 the user may have typed). So when
  // a date range is present, always fetch as deep as our safety cap
  // allows rather than capping the raw fetch at the user's typed number.
  const hasDateRange = Boolean(dateFrom || dateTo);
  // The scraper returns newest first, so to reach the start date it only has to go back that many days:
  // about 3 posts a day (plus a margin) covers even a heavy poster, instead of asking for thousands.
  const daysBack = dateFrom ? Math.max(1, Math.ceil((Date.now() - new Date(`${dateFrom}T00:00:00`).getTime()) / 86_400_000)) : null;
  const fetchLimit = hasDateRange ? (daysBack != null ? daysBack * 3 + 20 : MAX_RESULTS_LIMIT) : resultsLimit ?? MAX_RESULTS_LIMIT;

  const items = await runProfileReelsScraper({
    username,
    // the scraper accepts at most 1000 posts per pull
    maxResults: Math.min(Math.max(fetchLimit, 30), 1000),
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
  // Reels already saved are left out BEFORE any work is done on them (each one costs a picture download and upload),
  // and the new ones are prepared 20 at a time, so a pull of hundreds of reels finishes instead of timing out.
  const savedUrls = new Set<string>();
  const candidateUrls = filtered.filter((i) => i.code).map((i) => `https://www.instagram.com/p/${i.code}/`);
  for (let i = 0; i < candidateUrls.length; i += 100) {
    const { data: already } = await supabase.from("ct_reels").select("url").in("url", candidateUrls.slice(i, i + 100));
    (already ?? []).forEach((r) => savedUrls.add(r.url as string));
  }
  const newItems = filtered.filter((i) => !i.code || !savedUrls.has(`https://www.instagram.com/p/${i.code}/`));
  const reelRows: Awaited<ReturnType<typeof toReelRow>>[] = [];
  for (let i = 0; i < newItems.length; i += 20) {
    reelRows.push(...(await Promise.all(newItems.slice(i, i + 20).map((item) => toReelRow(item, batch.id)))));
  }
  // Carousels are only pulled when you ask for them
  const wantCarousels = String(formData.get("includeCarousels") ?? "") === "1";
  const carouselRows = wantCarousels
    ? await pullCarouselRows({ username, dateFrom, dateTo, limit: hasDateRange ? (daysBack != null ? daysBack * 4 + 30 : 1000) : resultsLimit != null ? resultsLimit * 3 : 1000, batchId: batch.id as string })
    : [];
  const rows = [...reelRows, ...carouselRows] as typeof reelRows;

  // Never save a duplicate: reels that are already in your database are left exactly as they are.
  // checked 100 at a time, so a big pull never makes the request too long to send
  const have = new Set<string>();
  for (let i = 0; i < rows.length; i += 100) {
    const { data: already, error: lookupError } = await supabase
      .from("ct_reels")
      .select("url")
      .in("url", rows.slice(i, i + 100).map((r) => r.url));
    if (lookupError) throw new Error(lookupError.message);
    (already ?? []).forEach((r) => have.add(r.url as string));
  }
  const fresh = rows.filter((r) => !have.has(r.url));
  const skipped = rows.length - fresh.length + (filtered.length - newItems.length);

  if (fresh.length > 0) {
    const { error: reelsError } = await supabase.from("ct_reels").insert(fresh);
    if (reelsError) throw new Error(reelsError.message);
  } else {
    await supabase.from("ct_research_batches").delete().eq("id", batch.id);
  }

  revalidatePath("/analyze-reel");
  return { batchId: fresh.length > 0 ? (batch.id as string) : null, added: fresh.length, skipped };
}

export type PullJob = { id: string; username: string; status: "running" | "done" | "error"; added: number | null; skipped: number | null; error: string | null };

// Starts a profile pull in the background and returns straight away, so you can keep using the site while it runs.
// The result (or the error) is saved on a job row that the Analyze page shows.
export async function startProfileResearch(formData: FormData): Promise<{ jobId: string }> {
  const profileUrl = String(formData.get("profileUrl") ?? "").trim();
  if (!profileUrl) throw new Error("Instagram profile URL is required");
  const username = profileUsername(profileUrl);
  const supabase = await createClient();
  const { data: job, error } = await supabase.from("ct_pull_jobs").insert({ username }).select("id").single();
  if (error || !job) throw new Error(error?.message ?? "Couldn't start the pull");
  after(async () => {
    const db = await createClient();
    try {
      const res = await runProfileResearch(formData);
      await db.from("ct_pull_jobs").update({ status: "done", added: res.added, skipped: res.skipped, finished_at: new Date().toISOString() }).eq("id", job.id);
    } catch (e) {
      await db.from("ct_pull_jobs").update({ status: "error", error: e instanceof Error ? e.message : "Something went wrong", finished_at: new Date().toISOString() }).eq("id", job.id);
    }
    revalidatePath("/analyze-reel");
    revalidatePath("/reels");
  });
  return { jobId: job.id as string };
}

// Pulls started in the last 15 minutes (running or finished), newest first.
export async function listPullJobs(): Promise<PullJob[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("ct_pull_jobs")
    .select("id, username, status, added, skipped, error")
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(8);
  return (data ?? []) as PullJob[];
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
function isAnalyzed(r: { shares_count: number | null; reposts_count: number | null; saves_count: number | null; transcription_status: string | null; post_type?: string | null }) {
  // a carousel is analyzed once its slides have been read
  if (r.post_type === "carousel") return r.transcription_status === "ready";
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
    .select("url, shares_count, reposts_count, saves_count, transcription_status, post_type")
    .in(
      "url",
      canonicalByRaw.map((c) => c.url),
    );

  const existingUrls = new Set((existing ?? []).filter(isAnalyzed).map((r) => r.url));
  return canonicalByRaw
    .filter((c) => existingUrls.has(c.url))
    .map((c) => ({ url: c.url, shortCode: c.code }));
}

// Reads the slides of a carousel that has been pulled in but not read yet.
export async function readCarousel(reelId: string): Promise<void> {
  await readCarouselSlides(reelId);
  revalidatePath("/analyze-reel");
}

// Analyze in the background: marks the posts as "being analyzed" and returns straight away. The work runs on the
// server, so it carries on even if you leave the page, and every page shows it as analyzing until it's done.
export async function startAnalysis(urls: string[]): Promise<{ started: number }> {
  const clean = urls.map((u) => u.trim()).filter(Boolean);
  if (clean.length === 0) return { started: 0 };
  const canonical = clean
    .map((u) => extractShortCode(u))
    .filter((c): c is string => Boolean(c))
    .map((c) => `https://www.instagram.com/p/${c}/`);
  const supabase = await createClient();
  if (canonical.length > 0) {
    await supabase.from("ct_reels").update({ analyzing_since: new Date().toISOString() }).in("url", canonical).or("transcription_status.is.null,transcription_status.neq.ready");
  }
  // every link gets a visible status on the Analyze page: working, done, or failed with the link to paste again
  const { data: tracked } = await supabase.from("ct_analysis_links").insert(clean.map((u) => ({ url: u, short_code: extractShortCode(u) }))).select("id, short_code");
  after(async () => {
    const started = Date.now();
    let failure: string | null = null;
    try {
      const fd = new FormData();
      fd.set("reelUrl", clean.join(String.fromCharCode(10)));
      await analyzeSingleReel(fd);
    } catch (e) {
      failure = e instanceof Error ? e.message : "Something went wrong";
    }
    await pollTranscriptionsForUrls(canonical, started + 55_000);
    // what actually got saved decides each link's result
    const { data: saved } = await supabase.from("ct_reels").select("url, transcription_status, transcription_error").in("url", canonical.length > 0 ? canonical : [""]);
    const byUrl = new Map((saved ?? []).map((r) => [r.url as string, r]));
    for (const t of tracked ?? []) {
      const code = t.short_code as string | null;
      const r = code ? byUrl.get(`https://www.instagram.com/p/${code}/`) : undefined;
      let status: "done" | "error" = "done";
      let note: string | null = null;
      if (!code) {
        status = "error";
        note = "That doesn't look like a reel or post link.";
      } else if (!r) {
        status = "error";
        note = failure ? `Couldn't pull it: ${failure}` : "Couldn't pull this post. It may be private or deleted, or the data source missed it.";
      } else if (r.transcription_status === "error") {
        if (isNoAudioError(r.transcription_error as string | null)) note = "Saved. It has no audio to transcribe.";
        else {
          status = "error";
          note = "Saved, but the transcription failed. Open it in your Library and press Transcribe.";
        }
      } else if (r.transcription_status === "processing") {
        note = "Saved. The transcript is still finishing.";
      }
      await supabase.from("ct_analysis_links").update({ status, note, finished_at: new Date().toISOString() }).eq("id", t.id);
    }
    revalidatePath("/analyze-reel");
  });
  return { started: clean.length };
}

// Marks the posts as "being analyzed" in the database first, so every page (Library, creator, reel page)
// shows it right away, and clears the mark when the work is done or fails.
export async function analyzeSingleReel(
  formData: FormData,
): Promise<{ batchId: string | null; skipped?: number }> {
  const requested = String(formData.get("reelUrl") ?? "")
    .split(String.fromCharCode(10))
    .map((u) => u.trim())
    .filter(Boolean);
  if (requested.length === 0) throw new Error("At least one reel URL is required");
  const urls = requested
    .map((u) => extractShortCode(u))
    .filter((c): c is string => Boolean(c))
    .map((c) => `https://www.instagram.com/p/${c}/`);
  const supabase = await createClient();
  if (urls.length > 0) {
    await supabase.from("ct_reels").update({ analyzing_since: new Date().toISOString() }).in("url", urls).or("transcription_status.is.null,transcription_status.neq.ready");
  }
  try {
    return await runAnalysis(requested);
  } finally {
    if (urls.length > 0) await supabase.from("ct_reels").update({ analyzing_since: null }).in("url", urls);
    revalidatePath("/creators", "layout");
    revalidatePath("/reels");
  }
}

async function runAnalysis(requested: string[]): Promise<{ batchId: string | null; skipped?: number }> {
  const supabase = await createClient();

  // A link that is already saved is never pulled again, whatever it has or doesn't have: no scraper credit is spent.
  const canonical = requested.map((u) => extractShortCode(u)).filter((c): c is string => !!c).map((c) => `https://www.instagram.com/p/${c}/`);
  const { data: savedAlready } = await supabase.from("ct_reels").select("url").in("url", canonical.length > 0 ? canonical : [""]);
  const doneUrls = new Set((savedAlready ?? []).map((r) => r.url as string));
  // A carousel that already has its slide links needs no scraper at all: its pictures are just saved and it is marked done.
  const { data: carouselRows } = await supabase.from("ct_reels").select("id, url, slides, transcription_status").eq("post_type", "carousel").in("url", canonical.length > 0 ? canonical : [""]);
  const carouselsToSave = (carouselRows ?? []).filter((c) => Array.isArray(c.slides) && (c.slides as unknown[]).length > 0 && c.transcription_status !== "ready");
  if (carouselsToSave.length > 0) await Promise.allSettled(carouselsToSave.map((c) => readCarouselSlides(c.id as string)));
  const savedCarouselUrls = new Set(carouselsToSave.map((c) => c.url as string));
  const reelUrls = requested.filter((u) => {
    const code = extractShortCode(u);
    const canon = code ? `https://www.instagram.com/p/${code}/` : null;
    return !(canon && (doneUrls.has(canon) || savedCarouselUrls.has(canon)));
  });
  if (doneUrls.size > 0) {
    // Already pulled in full: no scraper credit, just make sure each one is transcribed.
    try {
      const { data: have } = await supabase.from("ct_reels").select("id").in("url", [...doneUrls]);
      const ids = (have ?? []).map((r) => r.id as string);
      if (ids.length > 0) await transcribeSelectedReels(ids);
      await Promise.allSettled(ids.map((id) => readCarouselSlides(id)));
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

  const partialCodes = new Set(items.filter((i) => i.partial && i.code).map((i) => i.code as string));
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
        const base = row.short_code && partialCodes.has(row.short_code) ? withoutBlanks(rest) : rest;
        const fields = hasFreshTranscript
          ? { ...base, transcript, transcription_status, created_at: new Date().toISOString() }
          : { ...base, created_at: new Date().toISOString() };
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
        .select("id, transcript, transcription_status, post_type")
        .in("url", rowsWithTranscripts.map((r) => r.url));
      const needs = (saved ?? [])
        .filter((r) => r.post_type === "reel" && !r.transcript && r.transcription_status !== "processing" && r.transcription_status !== "ready")
        .map((r) => r.id as string);
      if (needs.length > 0) await transcribeSelectedReels(needs);
      // Carousels are read the same way: one small AI call over all the slides.
      const slideReads = (saved ?? []).filter((r) => r.post_type === "carousel" && r.transcription_status !== "ready" && r.transcription_status !== "processing").map((r) => r.id as string);
      await Promise.allSettled(slideReads.map((id) => readCarouselSlides(id)));
    } catch {
      // the reel page keeps its Transcribe button as a backup
    }
  }

  revalidatePath("/analyze-reel");
  return { batchId, skipped: requested.length - reelUrls.length };
}
