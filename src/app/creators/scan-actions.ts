"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveThumbnailPermanently } from "@/lib/reel-thumbnail";
import { persistSlides, type Slide } from "@/lib/carousel-read";
import { BACKUP_PROVIDER, PRIMARY_PROVIDER, fetchAllItems, mapItem, runState, startRun, type ScanKind, type ScanOptions, type ScanProvider } from "@/lib/scan-providers";

export type ScanJobView = {
  id: string;
  username: string;
  status: "running" | "importing" | "done" | "error";
  provider: string;
  kind: "reels" | "carousels";
  found: number;
  added: number;
  skipped: number;
  error: string | null;
};

type JobRow = {
  id: string;
  username: string;
  status: string;
  provider: string;
  run_id: string | null;
  dataset_id: string | null;
  input: { limit: number | null; sinceDays: number | null; sinceDate: string | null; kind?: ScanKind };
  date_to: string | null;
  found: number;
  added: number;
  skipped: number;
  error: string | null;
};

const view = (j: JobRow): ScanJobView => ({
  id: j.id,
  username: j.username,
  status: j.status as ScanJobView["status"],
  provider: j.provider,
  kind: j.input?.kind === "carousels" ? "carousels" : "reels",
  found: j.found,
  added: j.added,
  skipped: j.skipped,
  error: j.error,
});

function parseUsername(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const url = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const name = (url ? url[1] : s.replace(/^@/, "")).replace(/\/.*$/, "");
  if (!/^[A-Za-z0-9._]+$/.test(name)) return null;
  if (["p", "reel", "reels", "explore", "stories", "accounts"].includes(name.toLowerCase())) return null;
  return name.toLowerCase();
}

// "Both" runs one scan for reels and one for carousels, so each stays cheap and reports on its own.
export async function startCreatorScan(opts: { input: string; limit: number | null; range: string; from?: string; to?: string; kind?: ScanKind }): Promise<ScanJobView[]> {
  const kinds: ("reels" | "carousels")[] = opts.kind === "both" ? ["reels", "carousels"] : [opts.kind === "carousels" ? "carousels" : "reels"];
  const out: ScanJobView[] = [];
  for (const k of kinds) out.push(await startOneScan({ ...opts, kind: k }));
  return out;
}

async function startOneScan(opts: { input: string; limit: number | null; range: string; from?: string; to?: string; kind: "reels" | "carousels" }): Promise<ScanJobView> {
  const username = parseUsername(opts.input);
  if (!username) throw new Error("That doesn't look like an Instagram profile link or @handle.");
  const supabase = await createClient();

  const { data: running } = await supabase.from("ct_scan_jobs").select("*").eq("username", username).in("status", ["running", "importing"]);
  const same = ((running ?? []) as JobRow[]).find((j) => (j.input?.kind ?? "reels") === opts.kind);
  if (same) return view(same);

  const sinceDays = ["7", "14", "30", "60", "90"].includes(opts.range) ? Number(opts.range) : null;
  const sinceDate = opts.range === "custom" && opts.from ? opts.from : null;
  const limit = opts.limit && opts.limit > 0 ? Math.min(Math.floor(opts.limit), 10000) : null;
  const scanOpts: ScanOptions = { username, limit, sinceDays, sinceDate, kind: opts.kind };

  const { runId, datasetId } = await startRun(PRIMARY_PROVIDER, scanOpts);
  const { data, error } = await supabase
    .from("ct_scan_jobs")
    .insert({ username, provider: PRIMARY_PROVIDER, run_id: runId, dataset_id: datasetId, input: { limit, sinceDays, sinceDate, kind: opts.kind }, date_to: opts.range === "custom" ? (opts.to ?? null) : null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return view(data as JobRow);
}

export async function listActiveScans(): Promise<ScanJobView[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data } = await supabase.from("ct_scan_jobs").select("*").in("status", ["running", "importing"]).gte("created_at", since).order("created_at");
  return ((data ?? []) as JobRow[]).map(view);
}

// Checks on a scan. When the provider is finished, this also saves the reels. Safe to call again and again.
export async function pollScan(jobId: string): Promise<ScanJobView> {
  const supabase = await createClient();
  const { data } = await supabase.from("ct_scan_jobs").select("*").eq("id", jobId).single();
  const job = data as JobRow | null;
  if (!job) throw new Error("Scan not found");
  if (job.status !== "running" || !job.run_id || !job.dataset_id) return view(job);

  const { state, found } = await runState(job.run_id, job.dataset_id);
  if (state === "running") {
    if (found !== job.found) await supabase.from("ct_scan_jobs").update({ found }).eq("id", job.id);
    return view({ ...job, found });
  }

  if (state === "failed") return fallbackOrFail(job, "The scan didn't finish. Try again in a moment.");

  // Finished with results. Only one caller gets to save them.
  const { data: locked } = await supabase.from("ct_scan_jobs").update({ status: "importing", found }).eq("id", job.id).eq("status", "running").select("*").maybeSingle();
  if (!locked) {
    const { data: cur } = await supabase.from("ct_scan_jobs").select("*").eq("id", job.id).single();
    return view(cur as JobRow);
  }
  try {
    const result = await importScan(job);
    if (result.empty) {
      const { data: reset } = await supabase.from("ct_scan_jobs").update({ status: "running" }).eq("id", job.id).select("*").single();
      return fallbackOrFail((reset as JobRow) ?? job, job.input?.kind === "carousels" ? "No carousels found." : "No reels found. Is the profile public?");
    }
    const { data: done } = await supabase
      .from("ct_scan_jobs")
      .update({ status: "done", added: result.added, skipped: result.skipped, found: result.total, finished_at: new Date().toISOString() })
      .eq("id", job.id)
      .select("*")
      .single();
    revalidatePath("/creators", "layout");
    return view(done as JobRow);
  } catch (e) {
    const { data: failed } = await supabase
      .from("ct_scan_jobs")
      .update({ status: "error", error: e instanceof Error ? e.message : "Couldn't save the scan", finished_at: new Date().toISOString() })
      .eq("id", job.id)
      .select("*")
      .single();
    return view(failed as JobRow);
  }
}

// The cheap provider didn't deliver: try once on the backup before giving up.
async function fallbackOrFail(job: JobRow, message: string): Promise<ScanJobView> {
  const supabase = await createClient();
  // the backup scraper only knows reels
  if (job.provider === PRIMARY_PROVIDER && job.input?.kind !== "carousels") {
    try {
      const { runId, datasetId } = await startRun(BACKUP_PROVIDER, { username: job.username, ...job.input });
      const { data: next } = await supabase.from("ct_scan_jobs").update({ status: "running", provider: BACKUP_PROVIDER, run_id: runId, dataset_id: datasetId, found: 0 }).eq("id", job.id).select("*").single();
      return view(next as JobRow);
    } catch {}
  }
  const { data: failed } = await supabase.from("ct_scan_jobs").update({ status: "error", error: message, finished_at: new Date().toISOString() }).eq("id", job.id).select("*").single();
  return view(failed as JobRow);
}

async function importScan(job: JobRow): Promise<{ added: number; skipped: number; total: number; empty?: boolean }> {
  const supabase = await createClient();
  const provider = job.provider as ScanProvider;
  const items = await fetchAllItems(job.dataset_id as string);
  if (items.length === 0) return { added: 0, skipped: 0, total: 0, empty: true };

  const cutoff = job.input.sinceDays ? Date.now() - job.input.sinceDays * 86400000 : job.input.sinceDate ? new Date(job.input.sinceDate + "T00:00:00").getTime() : -Infinity;
  const until = job.date_to ? new Date(job.date_to + "T23:59:59").getTime() : Infinity;

  const seen = new Set<string>();
  const reels = items
    .map((it) => mapItem(provider, it, { kind: job.input?.kind }))
    .filter((r): r is NonNullable<typeof r> => {
      if (!r || seen.has(r.code)) return false;
      seen.add(r.code);
      const t = r.postedAt ? new Date(r.postedAt).getTime() : null;
      return t == null || (t >= cutoff && t <= until);
    });
  if (reels.length === 0) return { added: 0, skipped: 0, total: items.length };

  // Never save a reel you already have: they're left exactly as they are.
  const urlOf = (code: string) => `https://www.instagram.com/p/${code}/`;
  const have = new Set<string>();
  for (let i = 0; i < reels.length; i += 150) {
    const { data } = await supabase.from("ct_reels").select("url").in("url", reels.slice(i, i + 150).map((r) => urlOf(r.code)));
    for (const row of data ?? []) have.add(row.url as string);
  }
  const fresh = reels.filter((r) => !have.has(urlOf(r.code)));
  if (fresh.length === 0) return { added: 0, skipped: reels.length, total: items.length };

  const { data: batch, error: batchError } = await supabase
    .from("ct_research_batches")
    .insert({ kind: "profile", input_value: job.username, creator_username: job.username, results_limit: job.input.limit, raw_fetch_count: items.length, hidden_from_recent: true })
    .select("id")
    .single();
  if (batchError) throw new Error(batchError.message);

  const rows = fresh.map((r) => ({
    batch_id: batch.id as string,
    short_code: r.code,
    url: urlOf(r.code),
    caption: r.caption,
    thumbnail_url: r.thumbnailUrl,
    video_url: r.videoUrl,
    owner_username: r.owner ?? job.username,
    posted_at: r.postedAt,
    views: r.views,
    likes: r.likes,
    comments_count: r.comments,
    duration_seconds: r.durationSeconds,
    scan_only: true,
    post_type: r.postType,
    ...(r.postType === "carousel" && r.slides.length > 0 ? { slides: r.slides.map((url) => ({ url })) } : {}),
  }));
  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await supabase.from("ct_reels").upsert(rows.slice(i, i + 400), { onConflict: "url", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return { added: fresh.length, skipped: reels.length - fresh.length, total: items.length };
}

// Instagram picture links expire after about a week, so scanned reels get their pictures saved permanently,
// a few dozen at a time.
export async function persistThumbnails(max = 40): Promise<{ processed: number; remaining: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ct_reels")
    .select("id, short_code, thumbnail_url")
    .eq("scan_only", true)
    .not("thumbnail_url", "is", null)
    .not("thumbnail_url", "like", "%supabase.co%")
    .limit(max);
  const list = data ?? [];
  let processed = 0;
  for (let i = 0; i < list.length; i += 8) {
    await Promise.all(
      list.slice(i, i + 8).map(async (r) => {
        const saved = await saveThumbnailPermanently(r.thumbnail_url as string, r.short_code as string);
        if (saved) {
          await supabase.from("ct_reels").update({ thumbnail_url: saved }).eq("id", r.id);
          processed++;
        } else {
          // an expired link can't be saved; stop retrying it
          await supabase.from("ct_reels").update({ thumbnail_url: null }).eq("id", r.id);
        }
      }),
    );
  }
  // carousel slides, a few carousels at a time
  const { data: cars } = await supabase.from("ct_reels").select("id, short_code, slides").eq("scan_only", true).eq("post_type", "carousel").not("slides", "is", null).limit(300);
  const pending = (cars ?? []).filter((r) => ((r.slides as Slide[] | null) ?? []).some((x) => !x.url.includes("supabase.co")));
  for (const r of pending.slice(0, 4)) {
    const saved = await persistSlides(r.short_code as string, r.slides as Slide[]);
    await supabase.from("ct_reels").update({ slides: saved }).eq("id", r.id);
    processed++;
  }
  const { count } = await supabase
    .from("ct_reels")
    .select("id", { count: "exact", head: true })
    .eq("scan_only", true)
    .not("thumbnail_url", "is", null)
    .not("thumbnail_url", "like", "%supabase.co%");
  return { processed, remaining: (count ?? 0) + Math.max(0, pending.length - 4) };
}
