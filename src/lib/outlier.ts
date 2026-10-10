// Outlier scores compare a reel to that creator's typical (median) reel.
// A median is used so one viral reel can't make every other reel look weak.
export const MIN_REELS_FOR_OUTLIER = 5;

export type OutlierGoal = "views" | "comments" | "shares";
export const OUTLIER_GOALS: { key: OutlierGoal; label: string; icon: string }[] = [
  { key: "views", label: "Views", icon: "visibility" },
  { key: "comments", label: "Comments", icon: "comment" },
  { key: "shares", label: "Shares", icon: "send" },
];

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

type Metric = { views: number | null; comments: number | null; shares: number | null };

export function goalValue(r: Metric, goal: OutlierGoal): number | null {
  return goal === "views" ? r.views : goal === "comments" ? r.comments : r.shares;
}

// Typical value per goal, or null when there aren't enough reels to say.
export function typicalByGoal(reels: Metric[]): Record<OutlierGoal, number | null> {
  const out = {} as Record<OutlierGoal, number | null>;
  for (const g of OUTLIER_GOALS) {
    const vals = reels.map((r) => goalValue(r, g.key)).filter((v): v is number => v != null);
    const typ = vals.length >= MIN_REELS_FOR_OUTLIER ? median(vals) : null;
    out[g.key] = typ && typ > 0 ? typ : null;
  }
  return out;
}

export function outlierOf(r: Metric, goal: OutlierGoal, typical: Record<OutlierGoal, number | null>): number | null {
  const v = goalValue(r, goal);
  const t = typical[goal];
  return v == null || t == null ? null : v / t;
}

export const fmtOutlier = (x: number | null) => (x == null ? "—" : `${x >= 10 ? x.toFixed(0) : x.toFixed(1)}x`);
