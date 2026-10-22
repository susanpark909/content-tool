import type { CreatorCard } from "@/app/creators/creator-list";
import { fmtN } from "@/lib/format";

export type CardPost = {
  id?: string;
  owner: string;
  avatar: string | null;
  thumb: string | null;
  views: number;
  likes: number;
  comments: number;
  shares?: number | null;
  postType: string;
  at: string; // when it was added, used to put the newest creators first
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const fmtPct = (n: number) => (n * 100).toFixed(2) + "%";

// One card per creator, from whichever posts are given (so filters in the Library bar carry over).
export function buildCreatorCards(posts: CardPost[], favorites: string[]): CreatorCard[] {
  type Agg = { mostComm: { n: number; thumb: string | null; id: string }; avatar: string | null; views: number[]; comments: number[]; shares: number[]; mostShared: { n: number; thumb: string | null; id: string }; likes: number[]; engagement: number[]; best: { views: number; thumb: string | null; id: string }; last: string; posts: number };
  const by = new Map<string, Agg>();
  for (const r of posts) {
    if (!r.owner) continue;
    const a = by.get(r.owner) ?? { mostComm: { n: -1, thumb: null, id: "" }, avatar: null, views: [], comments: [], shares: [], mostShared: { n: -1, thumb: null, id: "" }, likes: [], engagement: [], best: { views: -1, thumb: null, id: "" }, last: "", posts: 0 };
    a.avatar = a.avatar ?? r.avatar;
    a.posts++;
    // carousels have no view counts, so the averages come from reels only
    if (r.postType === "carousel") {
      if (a.best.thumb == null) a.best = { views: -1, thumb: r.thumb, id: r.id ?? "" };
    } else {
      a.views.push(r.views);
      a.comments.push(r.comments);
      if (r.shares != null) {
        a.shares.push(r.shares);
        if (r.shares > a.mostShared.n) a.mostShared = { n: r.shares, thumb: r.thumb, id: r.id ?? "" };
      }
      if (r.views > 0) a.engagement.push(r.comments / r.views);
      if (r.likes >= 0) a.likes.push(r.likes);
      if (r.views > a.best.views || a.best.views < 0) a.best = { views: r.views, thumb: r.thumb, id: r.id ?? "" };
      if (r.comments > a.mostComm.n) a.mostComm = { n: r.comments, thumb: r.thumb, id: r.id ?? "" };
    }
    if (r.at > a.last) a.last = r.at;
    by.set(r.owner, a);
  }
  return [...by.entries()]
    .sort((x, y) => (y[1].last > x[1].last ? 1 : -1))
    .map(([username, a]) => ({
      username,
      avatar: a.avatar,
      reels: a.posts,
      avgViews: fmtN(avg(a.views)),
      avgComments: fmtN(avg(a.comments)),
      avgLikes: fmtN(avg(a.likes)),
      avgShares: a.shares.length ? fmtN(avg(a.shares)) : "—",
      mostShares: a.mostShared.n >= 0 ? fmtN(a.mostShared.n) : "—",
      mostSharesId: a.mostShared.id,
      avgEngagement: a.engagement.length ? fmtPct(avg(a.engagement)) : "—",
      avgShareRate: "—",
      bestViews: a.best.views > 0 ? fmtN(a.best.views) : "—",
      bestThumb: a.best.thumb,
      bestId: a.best.id,
      mostComments: a.mostComm.n > 0 ? fmtN(a.mostComm.n) : "—",
      mostCommentsThumb: a.mostComm.thumb,
      mostCommentsId: a.mostComm.id,
      n: { posts: a.posts, views: avg(a.views), comments: avg(a.comments), shares: a.shares.length ? avg(a.shares) : -1, mostShares: a.mostShared.n, engagement: a.engagement.length ? avg(a.engagement) : -1, best: a.best.views, mostComments: a.mostComm.n },
      favorite: favorites.includes(username),
    }));
}
