import { fetchAll } from "@/lib/fetch-all";
import { OUTLIER_GOALS, outlierOf, typicalByGoal, type OutlierGoal } from "@/lib/outlier";
import type { createClient } from "@/lib/supabase/server";

export type Outliers = Record<OutlierGoal, number | null>;
export const NO_OUTLIERS: Outliers = { views: null };

// Each creator's average views (over every post saved from them), so any post can be scored against it.
// Creators with fewer than 2 posts get no score.
export async function loadOutlierScorer(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await fetchAll((from, to) =>
    supabase.from("ct_reels").select("owner_username, views").or("post_type.is.null,post_type.neq.carousel").order("id").range(from, to),
  );
  const byOwner = new Map<string, { views: number | null }[]>();
  for (const r of data ?? []) {
    const u = r.owner_username as string | null;
    if (!u) continue;
    const list = byOwner.get(u) ?? [];
    list.push({ views: r.views as number | null });
    byOwner.set(u, list);
  }
  const typicals = new Map<string, Outliers>();
  for (const [u, list] of byOwner) typicals.set(u, typicalByGoal(list));

  return (owner: string | null, m: { views: number | null } & Record<string, unknown>): Outliers => {
    const typ = owner ? typicals.get(owner) : null;
    if (!typ) return NO_OUTLIERS;
    const out = {} as Outliers;
    for (const g of OUTLIER_GOALS) out[g.key] = outlierOf(m, g.key, typ);
    return out;
  };
}
