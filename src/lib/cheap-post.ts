// The cheap first look at a single post: what a shared link gets the moment it lands in the Queue.
// Two low-cost community scrapers, used only as needed:
//  - a reels scraper that takes a reel link and returns views, likes, comments and length;
//  - a posts scraper that takes any post link (reel or carousel) and returns likes, comments, caption,
//    creator and date, and tells us which kind of post it is (it has no view counts or length).
// Shares, saves and reposts are not in either; those come from the full pull when you press Analyze.
const REELS_ACTOR = "scrapesage~instagram-reels-scraper";
const POSTS_ACTOR = "khadinakbar~instagram-posts-scraper";

export type CheapPost = {
  postType: "reel" | "carousel";
  views: number | null;
  likes: number | null;
  comments: number | null;
  durationSeconds: number | null;
  caption: string | null;
  owner: string | null;
  postedAt: string | null;
  thumbnailUrl: string | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

async function run(actor: string, input: unknown): Promise<Record<string, unknown> | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=100`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const items = (await res.json()) as Record<string, unknown>[];
    return items?.[0] ?? null;
  } catch {
    return null;
  }
}

async function reelLook(url: string): Promise<CheapPost | null> {
  const o = await run(REELS_ACTOR, { reelUrls: [url], includeReelDetails: false, maxResults: 1 });
  if (!o) return null;
  const ts = num(o.takenAtTimestamp);
  return {
    postType: "reel",
    views: num(o.viewCount) ?? num(o.playCount),
    likes: num(o.likeCount),
    comments: num(o.commentCount),
    durationSeconds: num(o.duration),
    caption: str(o.caption),
    owner: str(o.ownerUsername),
    postedAt: ts ? new Date(ts * 1000).toISOString() : null,
    thumbnailUrl: str(o.thumbnailUrl),
  };
}

async function postLook(url: string): Promise<CheapPost | null> {
  const o = await run(POSTS_ACTOR, { directPostUrls: [url], includeRecentComments: false });
  if (!o) return null;
  const type = String(o.post_type ?? "").toUpperCase();
  const isCarousel = type.includes("CAROUSEL") || type.includes("SIDECAR") || type.includes("ALBUM");
  const isReel = !isCarousel && (o.is_reel === true || type.includes("REEL") || type.includes("CLIPS") || o.is_video === true);
  return {
    postType: isReel ? "reel" : "carousel",
    views: num(o.video_play_count) ?? num(o.video_view_count),
    likes: num(o.like_count),
    comments: num(o.comment_count),
    durationSeconds: num(o.video_duration),
    caption: str(o.caption),
    owner: str(o.owner_username),
    postedAt: str(o.timestamp),
    thumbnailUrl: str(o.display_url) ?? str(o.thumbnail_url),
  };
}

// The cheapest look of all: the community profile scraper (about 5 cents per 1,000 reels). It only takes a
// creator, not a single link, so when we already know who made the post we pull that creator's latest
// reels (a small window) and pick the post out of them. Not found (an older reel, or a carousel): null,
// and the next scraper takes over.
const PROFILE_ACTOR = "esdrasdw~instagram-content-scraper";
const PROFILE_WINDOW = 15;
async function communityLook(owner: string, url: string): Promise<CheapPost | null> {
  const token = process.env.APIFY_API_TOKEN;
  const code = url.match(/\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/)?.[1];
  if (!token || !code) return null;
  try {
    const res = await fetch(`https://api.apify.com/v2/acts/${PROFILE_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=40`, {
      signal: AbortSignal.timeout(42000),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [owner],
        resultsType: "reels",
        resultsLimit: PROFILE_WINDOW,
        selectedFields: ["displayUrl", "title", "ownerUsername", "url", "timestamp", "videoPlayCount", "igPlayCount", "likesCount", "commentsCount", "videoDuration", "shortCode", "caption"],
      }),
    });
    if (!res.ok) return null;
    const items = (await res.json()) as Record<string, unknown>[];
    const o = items.find((i) => i.shortCode === code);
    if (!o) return null;
    const likes = num(o.likesCount);
    return {
      postType: "reel",
      views: num(o.videoPlayCount) ?? num(o.igPlayCount),
      likes: likes != null && likes >= 0 ? likes : null,
      comments: num(o.commentsCount),
      durationSeconds: num(o.videoDuration),
      caption: str(o.caption) ?? str(o.title),
      owner: str(o.ownerUsername) ?? owner,
      postedAt: str(o.timestamp),
      thumbnailUrl: str(o.displayUrl),
    };
  } catch {
    return null;
  }
}

// `looksLikeReel` is true when the shared link was a /reel/ link, which lets us skip a step.
// `owner` is the creator when we already know it from the free preview.
export async function fetchCheapPost(url: string, looksLikeReel = false, owner: string | null = null): Promise<CheapPost | null> {
  if (owner) {
    const community = await communityLook(owner, url);
    if (community && community.views != null) return community;
  }
  if (looksLikeReel) {
    const r = await reelLook(url);
    if (r) return r;
  }
  const p = await postLook(url);
  if (!p) return looksLikeReel ? null : await reelLook(url);
  // a reel found through the posts scraper has no view count or length, so fetch those
  if (p.postType === "reel" && (p.views == null || p.durationSeconds == null)) {
    const r = await reelLook(url);
    if (r) {
      return {
        ...p,
        views: p.views ?? r.views,
        durationSeconds: p.durationSeconds ?? r.durationSeconds,
        likes: p.likes ?? r.likes,
        comments: p.comments ?? r.comments,
        thumbnailUrl: p.thumbnailUrl ?? r.thumbnailUrl,
      };
    }
  }
  return p;
}
