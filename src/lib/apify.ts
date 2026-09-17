const ACTOR_ID = "apify~instagram-reel-scraper";

export type ApifyReel = {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  displayUrl?: string;
  images?: string[];
  videoUrl?: string;
  ownerUsername?: string;
  timestamp?: string;
  videoViewCount?: number;
  videoPlayCount?: number;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
};

export async function runInstagramReelScraper(input: {
  username: string[];
  resultsLimit?: number;
  onlyPostsNewerThan?: string;
}): Promise<ApifyReel[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error(
      "APIFY_API_TOKEN is not set. Add it to .env.local and restart the dev server.",
    );
  }

  const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=180`;

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
