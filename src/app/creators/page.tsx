import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import { PageShell } from "@/components/ui/page-shell";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelCover } from "@/components/reel-thumb";
import { median } from "@/lib/outlier";

export const dynamic = "force-dynamic";

const fmtN = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k" : String(Math.round(n)));

// Creators you've pulled in bulk. Their reels live on their own page, not in the Library.
export default async function CreatorsPage() {
  const supabase = await createClient();
  const { data: reels, error } = await fetchAll((from, to) =>
    supabase
      .from("ct_reels")
      .select("owner_username, owner_avatar_url, thumbnail_url, views, created_at, ct_research_batches(kind)")
      .order("id")
      .range(from, to),
  );

  type Agg = { username: string; avatar: string | null; views: number[]; best: { views: number; thumb: string | null }; last: string };
  const byCreator = new Map<string, Agg>();
  for (const r of reels ?? []) {
    const batch = Array.isArray(r.ct_research_batches) ? r.ct_research_batches[0] : r.ct_research_batches;
    if (batch?.kind !== "profile" || !r.owner_username) continue;
    const u = r.owner_username as string;
    const a = byCreator.get(u) ?? { username: u, avatar: null, views: [], best: { views: -1, thumb: null }, last: "" };
    a.avatar = a.avatar ?? (r.owner_avatar_url as string | null);
    const v = (r.views as number) ?? 0;
    a.views.push(v);
    if (v > a.best.views) a.best = { views: v, thumb: r.thumbnail_url as string | null };
    if ((r.created_at as string) > a.last) a.last = r.created_at as string;
    byCreator.set(u, a);
  }
  const creators = [...byCreator.values()].sort((a, b) => (b.last > a.last ? 1 : -1));

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] leading-[0.95] font-black tracking-[-0.04em] md:text-[64px]">
          Creators
          <span className="ml-1 inline-block size-2 rounded-full bg-[#C6FF3D] align-baseline md:size-3" />
        </h1>
        <p className="mt-1 text-[13.5px] font-medium text-[#4a4a48] md:mt-2 md:text-[15px]">Scan a whole creator, then pick the reels worth studying.</p>
      </div>
      {error && <p className="text-sm text-destructive">Couldn&apos;t load creators: {error.message}</p>}

      {creators.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-[#F0F0F1] bg-white py-16 text-center shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#F0F0F1] text-[#6b6b69]">
            <MaterialIcon name="groups" size={24} />
          </span>
          <span className="text-[15px] font-extrabold">No creators yet</span>
          <span className="max-w-[320px] text-[13px] font-medium text-[#4a4a48]">Creators you scan will show up here.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:gap-6">
          {creators.map((c) => (
            <Link
              key={c.username}
              href={`/creators/${encodeURIComponent(c.username)}`}
              className="group flex flex-col gap-4 rounded-xl border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(13,13,13,0.16)]"
            >
              <div className="flex items-center gap-3">
                <span className="relative size-12 flex-none overflow-hidden rounded-full bg-[#2b2b29]">
                  {c.avatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar} alt="" className="absolute inset-0 size-full object-cover" />
                  )}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[16px] font-extrabold">@{c.username}</span>
                  <span className="text-[12.5px] font-semibold text-[#4a4a48]">{c.views.length} reels scanned</span>
                </div>
                <MaterialIcon name="chevron_right" size={22} className="ml-auto text-[#9a9a98] group-hover:text-[#FF1F8F]" />
              </div>
              <div className="flex items-stretch gap-3">
                <span className="relative aspect-[3/4] w-[72px] flex-none overflow-hidden rounded-md bg-[#2b2b29]">
                  <ReelCover url={c.best.thumb} showPlay={false} />
                </span>
                <div className="grid flex-1 grid-cols-1 content-center gap-2 text-[12.5px] font-bold">
                  <span className="flex items-center justify-between rounded-md bg-[#F6F6F5] px-2.5 py-1.5">
                    <span className="flex items-center gap-1 text-[#4a4a48]">
                      <MaterialIcon name="visibility" size={14} /> Typical reel
                    </span>
                    {fmtN(median(c.views) ?? 0)}
                  </span>
                  <span className="flex items-center justify-between rounded-md bg-[#F6F6F5] px-2.5 py-1.5">
                    <span className="flex items-center gap-1 text-[#4a4a48]">
                      <MaterialIcon name="trending_up" size={14} /> Best reel
                    </span>
                    {fmtN(c.best.views)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
