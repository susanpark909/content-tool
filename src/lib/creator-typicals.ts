import { fetchAll } from "@/lib/fetch-all";
import { OUTLIER_GOALS, outlierOf, typicalByGoal, type OutlierGoal } from "@/lib/outlier";
import type { createClient } from "@/lib/supabase/server";

export type Outliers = Record<OutlierGoal, number | null>;
export const NO_OUTLIERS: Outliers = { views: null, comments: null, shares: null };

// Each creator's typical reel (median of everything saved from them), so any reel can be
// scored against it. Creators with fewer than 5 reels get no score.
export async function loadOutlierScorer(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await fetchAll((from, to) =>
    supabase.from("ct_reels").select("owner_username, views, comments_count, shares_count").order("id").range(from, to),
  );
  const byOwner = new Map<string, { views: number | null; comments: number | null; shares: number | null }[]>();
  for (const r of data ?? []) {
    const u = r.owner_username as string | null;
    if (!u) continue;
    const list = byOwner.get(u) ?? [];
    list.push({ views: r.views as number | null, comments: r.comments_count as number | null, shares: r.shares_count as number | null });
    byOwner.set(u, list);
  }
  const typicals = new Map<string, Outliers>();
  for (const [u, list] of byOwner) typicals.set(u, typicalByGoal(list));

  return (owner: string | null, m: { views: number | null; comments: number | null; shares: number | null }): Outliers => {
    const typ = owner ? typicals.get(owner) : null;
    if (!typ) return NO_OUTLIERS;
    const out = {} as Outliers;
    for (const g of OUTLIER_GOALS) out[g.key] = outlierOf(m, g.key, typ);
    return out;
  };
}
