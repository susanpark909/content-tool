const PROFILE_REELS_ACTOR = "data-slayer~instagram-profile-reels";
const POST_DETAILS_ACTOR = "data-slayer~instagram-post-details";

export type ScrapedReel = {
  id?: string;
  code?: string;
  caption?: { text?: string } | string | null;
  taken_at_date?: string;
  play_count?: number;
  like_count?: number;
  comment_count?: number;
  // Instagram's own "share" icon (the circular-arrows repost count) maps to
  // `repost_count`, not `share_count` - `share_count` is a separate,
  // much larger internal metric (DM sends) that Instagram never displays
  // publicly, so using it made "Shares" wildly overstate what's on IG.
  repost_count?: number;
  thumbnail_url?: string;
  video_url?: string;
  video_duration?: number;
  user?: { username?: string; profile_pic_url?: string };
  // The post-details actor nests engagement metrics here instead of at the
  // top level (unlike the profile-reels actor, which returns them flat).
  metrics?: {
    play_count?: number;
    like_count?: number;
    comment_count?: number;
    repost_count?: number;
  };
};

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
    throw new Error(`Apify request failed (${response.status}): ${body}`);
  }

  return response.json();
}

export function runProfileReelsScraper(input: {
  username: string;
  maxResults?: number;
}): Promise<ScrapedReel[]> {
  return runActor(PROFILE_REELS_ACTOR, input);
}

export function runPostDetailsScraper(input: {
  postUrls: string[];
}): Promise<ScrapedReel[]> {
  return runActor(POST_DETAILS_ACTOR, input);
}
