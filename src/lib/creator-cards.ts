import type { CreatorCard } from "@/app/creators/creator-list";

export type CardPost = {
  id?: string;
  owner: string;
  avatar: string | null;
  thumb: string | null;
  views: number;
  likes: number;
  comments: number;
  postType: string;
  at: string; // when it was added, used to put the newest creators first
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const fmtN = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k" : String(Math.round(n)));
const fmtPct = (n: number) => (n * 100).toFixed(2) + "%";

// One card per creator, from whichever posts are given (so filters in the Library bar carry over).
export function buildCreatorCards(posts: CardPost[], favorites: string[]): CreatorCard[] {
  type Agg = { mostComm: { n: number; thumb: string | null; id: string }; avatar: string | null; views: number[]; comments: number[]; likes: number[]; engagement: number[]; best: { views: number; thumb: string | null; id: string }; last: string; posts: number };
  const by = new Map<string, Agg>();
  for (const r of posts) {
    if (!r.owner) continue;
    const a = by.get(r.owner) ?? { mostComm: { n: -1, thumb: null, id: "" }, avatar: null, views: [], comments: [], likes: [], engagement: [], best: { views: -1, thumb: null, id: "" }, last: "", posts: 0 };
    a.avatar = a.avatar ?? r.avatar;
    a.posts++;
    // carousels have no view counts, so the averages come from reels only
    if (r.postType === "carousel") {
      if (a.best.thumb == null) a.best = { views: -1, thumb: r.thumb, id: r.id ?? "" };
    } else {
      a.views.push(r.views);
      a.comments.push(r.comments);
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
      avgEngagement: a.engagement.length ? fmtPct(avg(a.engagement)) : "—",
      avgShareRate: "—",
      bestViews: a.best.views > 0 ? fmtN(a.best.views) : "—",
      bestThumb: a.best.thumb,
      bestId: a.best.id,
      mostComments: a.mostComm.n > 0 ? fmtN(a.mostComm.n) : "—",
      mostCommentsThumb: a.mostComm.thumb,
      mostCommentsId: a.mostComm.id,
      n: { posts: a.posts, views: avg(a.views), comments: avg(a.comments), engagement: a.engagement.length ? avg(a.engagement) : -1, best: a.best.views, mostComments: a.mostComm.n },
      favorite: favorites.includes(username),
    }));
}
