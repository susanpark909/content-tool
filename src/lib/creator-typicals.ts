import { fetchAll } from "@/lib/fetch-all";
import { OUTLIER_GOALS, outlierOf, typicalByGoal, typicalComments, type OutlierGoal } from "@/lib/outlier";
import type { createClient } from "@/lib/supabase/server";

export type Outliers = Record<OutlierGoal, number | null>;
export const NO_OUTLIERS: Outliers = { views: null };

// Each creator's average reel (by views) and average carousel (by comments, since carousels have no views), so any post
// can be scored against its own kind. A creator with fewer than 2 of that kind gets no score for it.
export async function loadOutlierScorer(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await fetchAll((from, to) => supabase.from("ct_reels").select("owner_username, views, comments_count, post_type").order("id").range(from, to));
  const reels = new Map<string, { views: number | null }[]>();
  const carousels = new Map<string, { comments: number | null }[]>();
  for (const r of data ?? []) {
    const u = r.owner_username as string | null;
    if (!u) continue;
    if (r.post_type === "carousel") {
      const list = carousels.get(u) ?? [];
      list.push({ comments: r.comments_count as number | null });
      carousels.set(u, list);
    } else {
      const list = reels.get(u) ?? [];
      list.push({ views: r.views as number | null });
      reels.set(u, list);
    }
  }
  const reelTypicals = new Map<string, Outliers>();
  for (const [u, list] of reels) reelTypicals.set(u, typicalByGoal(list));
  const carouselTypicals = new Map<string, number | null>();
  for (const [u, list] of carousels) carouselTypicals.set(u, typicalComments(list));

  return (owner: string | null, m: { views: number | null; comments?: number | null; postType?: string | null } & Record<string, unknown>): Outliers => {
    if (!owner) return NO_OUTLIERS;
    if (m.postType === "carousel") {
      const typ = carouselTypicals.get(owner);
      return typ && m.comments != null ? { views: m.comments / typ } : NO_OUTLIERS;
    }
    const typ = reelTypicals.get(owner);
    if (!typ) return NO_OUTLIERS;
    const out = {} as Outliers;
    for (const g of OUTLIER_GOALS) out[g.key] = outlierOf(m, g.key, typ);
    return out;
  };
}
