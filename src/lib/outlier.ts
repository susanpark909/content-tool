// Outlier score = a post's views compared with that creator's average post.
// It only exists when we have at least two posts from the creator to average.
export const MIN_REELS_FOR_OUTLIER = 2;
// Shown on hover wherever an outlier score is missing.
export const OUTLIER_NEEDS_TIP = `Outlier scores need at least ${MIN_REELS_FOR_OUTLIER} posts from that creator.`;

// Views is the only outlier measure now. The list shape stays so screens that loop over it keep working.
export type OutlierGoal = "views";
export const OUTLIER_GOALS: { key: OutlierGoal; label: string; icon: string }[] = [{ key: "views", label: "Views", icon: "visibility" }];

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

type Metric = { views: number | null } & Record<string, unknown>;

export function goalValue(r: Metric, _goal: OutlierGoal): number | null {
  void _goal;
  return r.views;
}

// The creator's average views, or null when there aren't enough posts to say.
export function typicalByGoal(reels: Metric[]): Record<OutlierGoal, number | null> {
  const vals = reels.map((r) => r.views).filter((v): v is number => v != null);
  const avg = vals.length >= MIN_REELS_FOR_OUTLIER ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  return { views: avg && avg > 0 ? avg : null };
}

export function outlierOf(r: Metric, goal: OutlierGoal, typical: Record<OutlierGoal, number | null>): number | null {
  const v = goalValue(r, goal);
  const t = typical[goal];
  return v == null || t == null ? null : v / t;
}

export const fmtOutlier = (x: number | null) => (x == null ? "—" : `${x >= 10 ? x.toFixed(0) : x.toFixed(1)}x`);
