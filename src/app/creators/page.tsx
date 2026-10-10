import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import { PageShell } from "@/components/ui/page-shell";
import { CreatorScanner } from "./scan-ui";
import { CreatorList } from "./creator-list";

export const dynamic = "force-dynamic";

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const fmtN = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k" : String(Math.round(n)));

// Every creator with 2 or more reels in your database.
export default async function CreatorsPage() {
  const supabase = await createClient();
  const { data: reels, error } = await fetchAll((from, to) =>
    supabase
      .from("ct_reels")
      .select("owner_username, owner_avatar_url, thumbnail_url, views, likes, comments_count, created_at")
      .order("id")
      .range(from, to),
  );

  type Agg = { username: string; avatar: string | null; views: number[]; comments: number[]; likes: number[]; best: { views: number; thumb: string | null }; last: string };
  const byCreator = new Map<string, Agg>();
  for (const r of reels ?? []) {
    if (!r.owner_username) continue;
    const u = r.owner_username as string;
    const a = byCreator.get(u) ?? { username: u, avatar: null, views: [], comments: [], likes: [], best: { views: -1, thumb: null }, last: "" };
    a.avatar = a.avatar ?? (r.owner_avatar_url as string | null);
    const v = (r.views as number) ?? 0;
    a.views.push(v);
    a.comments.push((r.comments_count as number) ?? 0);
    if (((r.likes as number) ?? -1) >= 0) a.likes.push(r.likes as number);
    if (v > a.best.views) a.best = { views: v, thumb: r.thumbnail_url as string | null };
    if ((r.created_at as string) > a.last) a.last = r.created_at as string;
    byCreator.set(u, a);
  }
  // Anyone with 2 or more reels in your database is a creator, however those reels got here.
  const creators = [...byCreator.values()].filter((c) => c.views.length >= 2).sort((a, b) => (b.last > a.last ? 1 : -1));

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] leading-[0.95] font-black tracking-[-0.04em] md:text-[64px]">
          Creators
          <span className="ml-1 inline-block size-2 rounded-full bg-[#C6FF3D] align-baseline md:size-3" />
        </h1>
        <p className="mt-1 text-[13.5px] font-medium text-[#4a4a48] md:mt-2 md:text-[15px]">Every creator you've scanned, all in one place.</p>
      </div>
      <CreatorScanner initial={[]} />

      {error && <p className="text-sm text-destructive">Couldn&apos;t load creators: {error.message}</p>}

      <CreatorList
        creators={creators.map((c) => ({
          username: c.username,
          avatar: c.avatar,
          reels: c.views.length,
          avgViews: fmtN(avg(c.views)),
          avgComments: fmtN(avg(c.comments)),
          avgLikes: fmtN(avg(c.likes)),
          bestThumb: c.best.thumb,
        }))}
      />
    </PageShell>
  );
}
