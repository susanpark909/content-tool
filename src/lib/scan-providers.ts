// Scanning a whole creator: starts a background run at the data provider, reports progress, and
// turns each provider's results into the same simple shape. The primary provider is the cheap one;
// if it fails, the scan restarts on the backup. Each provider is a small adapter, so adding or
// swapping one doesn't touch anything else.
export type ScanProvider = "esdrasdw" | "dataslayer";
export const PRIMARY_PROVIDER: ScanProvider = "esdrasdw";
export const BACKUP_PROVIDER: ScanProvider = "dataslayer";

const ACTORS: Record<ScanProvider, string> = {
  esdrasdw: "esdrasdw~instagram-content-scraper",
  dataslayer: "data-slayer~instagram-profile-reels",
};

export type ScanKind = "reels" | "carousels" | "both";
export type ScanOptions = { username: string; limit: number | null; sinceDays: number | null; sinceDate: string | null; kind?: ScanKind };

export type ScannedReel = {
  code: string;
  caption: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  postedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  durationSeconds: number | null;
  owner: string | null;
  postType: "reel" | "carousel";
  slides: string[];
};

function token() {
  const t = process.env.APIFY_API_TOKEN;
  if (!t) throw new Error("APIFY_API_TOKEN is not set.");
  return t;
}

function buildInput(provider: ScanProvider, o: ScanOptions) {
  if (provider === "esdrasdw") {
    return {
      directUrls: [o.username],
      resultsType: o.kind === "carousels" ? "posts" : "reels",
      resultsLimit: o.limit ?? 10000,
      ...(o.sinceDays ? { onlyPostsNewerThan: `${o.sinceDays} days` } : o.sinceDate ? { onlyPostsNewerThan: o.sinceDate } : {}),
      selectedFields: ["displayUrl", "title", "ownerUsername", "url", "timestamp", "videoPlayCount", "igPlayCount", "likesCount", "commentsCount", "videoDuration", "videoUrl", "shortCode", "caption", "productType", "childPosts"],
    };
  }
  return { username: o.username, maxResults: o.limit ?? 3000 };
}

export async function startRun(provider: ScanProvider, o: ScanOptions): Promise<{ runId: string; datasetId: string }> {
  const res = await fetch(`https://api.apify.com/v2/acts/${ACTORS[provider]}/runs?token=${token()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildInput(provider, o)),
  });
  if (!res.ok) throw new Error(`Couldn't start the scan (${res.status})`);
  const json = await res.json();
  return { runId: json.data.id as string, datasetId: json.data.defaultDatasetId as string };
}

export type RunState = "running" | "succeeded" | "failed";

export async function runState(runId: string, datasetId: string): Promise<{ state: RunState; found: number }> {
  const run = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token()}`).then((r) => r.json());
  const status = (run?.data?.status as string) ?? "FAILED";
  let found = 0;
  try {
    const ds = await fetch(`https://api.apify.com/v2/datasets/${datasetId}?token=${token()}`).then((r) => r.json());
    found = (ds?.data?.cleanItemCount as number) ?? (ds?.data?.itemCount as number) ?? 0;
  } catch {}
  if (status === "SUCCEEDED") return { state: "succeeded", found };
  if (["FAILED", "ABORTED", "ABORTING", "TIMED-OUT", "TIMING-OUT"].includes(status)) return { state: "failed", found };
  return { state: "running", found };
}

export async function fetchAllItems(datasetId: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const size = 1000;
  for (let offset = 0; ; offset += size) {
    const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token()}&clean=true&format=json&offset=${offset}&limit=${size}`);
    if (!res.ok) throw new Error("Couldn't read the scan results");
    const page = (await res.json()) as Record<string, unknown>[];
    out.push(...page);
    if (page.length < size) break;
  }
  return out;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Carousels come back in "posts" mode, which also holds single photos and reels: keep only what was asked for.
export function mapItem(provider: ScanProvider, item: Record<string, unknown>, o?: { kind?: ScanKind }): ScannedReel | null {
  if (provider === "esdrasdw") {
    const code = (item.shortCode as string | undefined) ?? "";
    if (!code) return null;
    const carousel = item.productType === "carousel_container";
    if (!carousel && o?.kind === "carousels") return null;
    return {
      code,
      caption: (item.caption as string | undefined) ?? (item.title as string | undefined) ?? null,
      thumbnailUrl: (item.displayUrl as string | undefined) ?? null,
      videoUrl: (item.videoUrl as string | undefined) ?? null,
      postedAt: (item.timestamp as string | undefined) ?? null,
      views: num(item.videoPlayCount) ?? num(item.igPlayCount) ?? 0,
      likes: num(item.likesCount) ?? 0,
      comments: num(item.commentsCount) ?? 0,
      durationSeconds: num(item.videoDuration),
      owner: (item.ownerUsername as string | undefined) ?? null,
      postType: carousel ? "carousel" : "reel",
      slides: carousel ? ((item.childPosts as { thumb?: string }[] | undefined) ?? []).map((c) => c.thumb ?? "").filter(Boolean) : [],
    };
  }
  const code = (item.code as string | undefined) ?? "";
  if (!code) return null;
  const cap = item.caption as { text?: string } | string | null | undefined;
  const user = item.user as { username?: string } | undefined;
  return {
    code,
    caption: typeof cap === "string" ? cap : (cap?.text ?? null),
    thumbnailUrl: (item.thumbnail_url as string | undefined) ?? null,
    videoUrl: (item.video_url as string | undefined) ?? null,
    postedAt: (item.taken_at_date as string | undefined) ?? null,
    views: num(item.play_count) ?? 0,
    likes: num(item.like_count) ?? 0,
    comments: num(item.comment_count) ?? 0,
    durationSeconds: num(item.video_duration),
    owner: user?.username ?? null,
    postType: "reel",
    slides: [],
  };
}
