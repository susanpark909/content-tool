// Engagement rate = comments ÷ views. It is the only percentage the app shows.
export type RateKey = "comments";

export const RATE_METRICS: { key: RateKey; label: string; icon: string; tip: string }[] = [{ key: "comments", label: "Comments", icon: "comment", tip: "Engagement rate" }];

type Counts = { views: number; comments: number | null } & Record<string, unknown>;

// A fraction (0.0123 = 1.23%), or null when the numbers aren't there.
export function rateOf(r: Counts, key: RateKey): number | null {
  if (r.views <= 0) return null;
  const n = r[key];
  if (n == null || n < 0) return null;
  return n / r.views;
}

export const fmtRate = (x: number | null) => (x == null ? "—" : x >= 0.1 ? (x * 100).toFixed(1) + "%" : (x * 100).toFixed(2) + "%");
