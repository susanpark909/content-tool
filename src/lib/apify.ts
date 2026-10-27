import { logScraperEvent } from "@/lib/scraper-health";
import { reportError } from "@/lib/error-report";
import { fetchCheapPost } from "@/lib/cheap-post";
import { mapItem, type ScannedReel } from "@/lib/scan-providers";

const PROFILE_REELS_ACTOR = "data-slayer~instagram-profile-reels";
const POST_DETAILS_ACTOR = "data-slayer~instagram-post-details";

// reel or carousel, from what a scraper returned
export function postTypeOf(item: ScrapedReel): "reel" | "carousel" {
  const t = `${item.post_type ?? ""} ${item.product_type ?? ""}`.toLowerCase();
  if (t.includes("carousel") || t.includes("sidecar") || t.includes("photo") || t.includes("image")) return "carousel";
  if (!item.video_url && !item.video_duration) return "carousel";
  return "reel";
}

export type ScrapedReel = {
  // true when a backup data source answered: it has no shares, saves, reposts or video link, so those are left alone
  partial?: boolean;
  post_type?: string;
  product_type?: string;
  id?: string;
  code?: string;
  caption?: { text?: string } | string | null;
  taken_at_date?: string;
  play_count?: number;
  like_count?: number;
  comment_count?: number;
  // Instagram now shows two different numbers: the paper-plane icon is
  // `share_count` (sends) and the circular-arrows icon is `repost_count`.
  // "Shares" in this app is the paper-plane one, `share_count`.
  share_count?: number;
  repost_count?: number;
  save_count?: number;
  thumbnail_url?: string;
  carousel_media?: { thumbnail_url?: string; image_versions?: { items?: { url?: string; width?: number }[] } }[];
  video_url?: string;
  video_duration?: number;
  user?: { username?: string; profile_pic_url?: string };
  // The post-details actor nests engagement metrics here instead of at the
  // top level (unlike the profile-reels actor, which returns them flat).
  metrics?: {
    play_count?: number;
    like_count?: number;
    comment_count?: number;
    share_count?: number;
    repost_count?: number;
    save_count?: number;
  };
};

// The scraper sometimes crashes while shutting down, after it has already finished and saved its results.
// Apify then marks the run failed, so take whatever it saved before giving up. Returns null if nothing was saved.
export async function recoverFailedRun(errorBody: string, token: string): Promise<unknown[] | null> {
  const runId = /run ID: (w+)/.exec(errorBody)?.[1];
  if (!runId) return null;
  try {
    const saved = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}&clean=true`);
    if (!saved.ok) return null;
    const items = (await saved.json()) as unknown[];
    return Array.isArray(items) && items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

async function runActor(actorId: string, input: unknown): Promise<ScrapedReel[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error(
      "APIFY_API_TOKEN is not set. Add it to .env.local and restart the dev server.",
    );
  }

  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=300`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.text();
    const saved = await recoverFailedRun(body, token);
    if (saved) return saved as ScrapedReel[];
    throw new Error(`Apify request failed (${response.status}): ${body}`);
  }

  return response.json();
}

// Tries each data source in order (cheapest good one first). A source that fails is retried once, then the next one
// takes over. Every attempt is logged so the app can warn when something is down.
export type Source<T> = { provider: string; run: () => Promise<T[]>; emptyIsFailure?: boolean };
export async function withFallback<T>(operation: string, sources: Source<T>[]): Promise<T[]> {
  let lastError: unknown = null;
  const began = Date.now();
  for (let s = 0; s < sources.length; s++) {
    const src = sources[s];
    for (let attempt = 0; attempt < 2; attempt++) {
      const t0 = Date.now();
      try {
        const out = await src.run();
        if (out.length === 0 && src.emptyIsFailure) throw new Error("Returned nothing");
        await logScraperEvent({ operation, provider: src.provider, ok: true, fallback: s > 0, ms: Date.now() - t0 });
        return out;
      } catch (e) {
        lastError = e;
        await logScraperEvent({ operation, provider: src.provider, ok: false, fallback: s > 0, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
        // a slow failure leaves no time for another go inside the page's time limit
        if (Date.now() - t0 > 100_000) break;
      }
    }
    if (Date.now() - began > 170_000) break;
  }
  const final = lastError instanceof Error ? lastError : new Error("The data source didn't answer");
  await reportError(`scraper:${operation}`, `Every data source failed. Last error: ${final.message}`);
  throw final;
}

function fromScanned(r: ScannedReel): ScrapedReel {
  return {
    partial: true,
    post_type: r.postType === "carousel" ? "carousel" : "reel",
    code: r.code,
    caption: r.caption ? { text: r.caption } : null,
    taken_at_date: r.postedAt ?? undefined,
    play_count: r.views,
    like_count: r.likes,
    comment_count: r.comments,
    thumbnail_url: r.thumbnailUrl ?? undefined,
    video_url: r.videoUrl ?? undefined,
    video_duration: r.durationSeconds ?? undefined,
    user: r.owner ? { username: r.owner } : undefined,
  };
}

// The two "instagram-scraper" actors return Instagram's own fields (no shares).
function fromInstaScraper(i: Record<string, unknown>): ScrapedReel | null {
  const code = i.shortcode as string | undefined;
  if (!code) return null;
  const user = (i.user ?? i.owner) as { username?: string; profile_pic_url?: string } | undefined;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  return {
    partial: true,
    post_type: "reel",
    code,
    caption: (i.caption as string | undefined) ?? null,
    taken_at_date: (i.taken_at as string | undefined) ?? undefined,
    play_count: num(i.play_count) ?? num(i.view_count),
    like_count: num(i.like_count),
    comment_count: num(i.comment_count),
    thumbnail_url: (i.image as string | undefined) ?? undefined,
    video_url: (i.video_url as string | undefined) ?? undefined,
    video_duration: num(i.video_duration),
    user: user ? { username: user.username, profile_pic_url: user.profile_pic_url } : undefined,
  };
}

async function runInstaScraper(actor: string, input: Record<string, unknown>): Promise<ScrapedReel[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not set.");
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=280`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  let items: unknown[];
  if (res.ok) items = (await res.json()) as unknown[];
  else {
    const saved = await recoverFailedRun(await res.text(), token);
    if (!saved) throw new Error(`${actor} failed (${res.status})`);
    items = saved;
  }
  return items.map((i) => fromInstaScraper(i as Record<string, unknown>)).filter((r): r is ScrapedReel => !!r);
}

// Creator pulls: cheapest data source first, no shares. If one fails or comes back empty, the next cheapest takes over.
// Prices per reel: esdrasdw $0.00004, profile posts scraper $0.00055, profile reels scraper $0.00059, data-slayer $0.00217.
export function runProfileReelsScraper(input: { username: string; maxResults?: number }): Promise<ScrapedReel[]> {
  const count = Math.max(input.maxResults ?? 30, 10);
  return withFallback<ScrapedReel>("profile-reels", [
    {
      provider: "esdrasdw",
      emptyIsFailure: true,
      run: async () => {
        const token = process.env.APIFY_API_TOKEN;
        if (!token) throw new Error("APIFY_API_TOKEN is not set.");
        const res = await fetch(`https://api.apify.com/v2/acts/esdrasdw~instagram-content-scraper/run-sync-get-dataset-items?token=${token}&timeout=280`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            directUrls: [input.username],
            resultsType: "reels",
            resultsLimit: count,
            selectedFields: ["displayUrl", "title", "ownerUsername", "url", "timestamp", "videoPlayCount", "igPlayCount", "likesCount", "commentsCount", "videoDuration", "videoUrl", "shortCode", "caption", "productType"],
          }),
        });
        let items: unknown[];
        if (res.ok) items = (await res.json()) as unknown[];
        else {
          const saved = await recoverFailedRun(await res.text(), token);
          if (!saved) throw new Error(`esdrasdw failed (${res.status})`);
          items = saved;
        }
        return items.map((i) => mapItem("esdrasdw", i as Record<string, unknown>)).filter((r): r is ScannedReel => !!r).map(fromScanned);
      },
    },
    {
      provider: "insta-profile-posts",
      emptyIsFailure: true,
      run: () => runInstaScraper("instagram-scraper~instagram-profile-posts-scraper", { instagramUsernames: [input.username], postsPerProfile: count, onlyVideo: true }),
    },
    {
      provider: "insta-profile-reels",
      emptyIsFailure: true,
      run: () => runInstaScraper("instagram-scraper~instagram-profile-reels-scraper", { instagramUsernames: [input.username], postsPerProfile: count }),
    },
    { provider: "data-slayer", run: () => runActor(PROFILE_REELS_ACTOR, { username: input.username, maxResults: count }) },
  ]);
}

export function runPostDetailsScraper(input: { postUrls: string[] }): Promise<ScrapedReel[]> {
  return withFallback<ScrapedReel>("post-details", [
    { provider: "data-slayer", run: () => runActor(POST_DETAILS_ACTOR, input), emptyIsFailure: true },
    {
      provider: "community",
      emptyIsFailure: true,
      run: async () => {
        const out: ScrapedReel[] = [];
        for (let i = 0; i < input.postUrls.length; i += 4) {
          const chunk = input.postUrls.slice(i, i + 4);
          const looked = await Promise.all(chunk.map((u) => fetchCheapPost(u, true, null)));
          looked.forEach((p, k) => {
            const code = chunk[k].match(/\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/)?.[1];
            if (!p || !code) return;
            out.push({
              partial: true,
              post_type: p.postType,
              code,
              caption: p.caption ? { text: p.caption } : null,
              taken_at_date: p.postedAt ?? undefined,
              play_count: p.views ?? undefined,
              like_count: p.likes ?? undefined,
              comment_count: p.comments ?? undefined,
              video_duration: p.durationSeconds ?? undefined,
              thumbnail_url: p.thumbnailUrl ?? undefined,
              user: p.owner ? { username: p.owner } : undefined,
            });
          });
        }
        return out;
      },
    },
  ]);
}

// The picture of each slide of a carousel, in order (video slides use their still frame).
export function slideUrlsOf(item: ScrapedReel): string[] {
  return (item.carousel_media ?? [])
    .map((m) => m.image_versions?.items?.[0]?.url ?? m.thumbnail_url ?? "")
    .filter(Boolean);
}
