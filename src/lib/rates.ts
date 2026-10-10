// "% of views": pick which number to measure against a reel's views (comments, likes, shares, reposts or saves).
export type RateKey = "comments" | "likes" | "shares" | "reposts" | "saves";

export const RATE_METRICS: { key: RateKey; label: string; icon: string; tip: string }[] = [
  { key: "comments", label: "Comments", icon: "comment", tip: "Engagement rate" },
  { key: "likes", label: "Likes", icon: "favorite", tip: "Like rate" },
  { key: "shares", label: "Shares", icon: "send", tip: "Share rate" },
  { key: "reposts", label: "Reposts", icon: "repeat", tip: "Repost rate" },
  { key: "saves", label: "Saves", icon: "bookmark", tip: "Save rate" },
];

type Counts = { views: number; likes: number | null; comments: number | null; shares: number | null; reposts: number | null; saves: number | null };

// A fraction (0.0123 = 1.23%), or null when Instagram doesn't show that number for the reel.
export function rateOf(r: Counts, key: RateKey): number | null {
  if (r.views <= 0) return null;
  const n = r[key];
  if (n == null || n < 0) return null;
  return n / r.views;
}

export const fmtRate = (x: number | null) => (x == null ? "—" : x >= 0.1 ? (x * 100).toFixed(1) + "%" : (x * 100).toFixed(2) + "%");
