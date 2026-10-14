"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelCover } from "@/components/reel-thumb";
import { FavoriteCreator } from "./favorite-creator";
import { Dropdown } from "@/components/dropdown";

const LIST_COLS = "minmax(260px,1fr) 70px 80px 90px 90px 120px 140px 48px";

export type CreatorCard = {
  username: string;
  avatar: string | null;
  reels: number;
  avgViews: string;
  avgComments: string;
  avgLikes: string;
  avgEngagement: string;
  avgShareRate: string;
  bestViews: string;
  bestThumb: string | null;
  bestId: string;
  mostComments: string;
  mostCommentsThumb: string | null;
  mostCommentsId: string;
  // raw numbers, for sorting
  n: { posts: number; views: number; comments: number; engagement: number; best: number; mostComments: number };
  favorite: boolean;
};

// The creator cards / list. Search and filters live in the Library bar above, so Posts and Creators always agree.
export function CreatorList({ creators, view, viewToggle }: { creators: CreatorCard[]; view: "grid" | "list"; viewToggle: React.ReactNode }) {
  const [addedDir, setAddedDir] = useState<1 | -1>(-1);
  // clicking a column header sorts by it (the Sort menu above is cleared)
  const [col, setCol] = useState<{ key: keyof CreatorCard["n"]; dir: 1 | -1 } | null>(null);
  const pickCol = (key: keyof CreatorCard["n"]) => setCol((c) => (c && c.key === key ? { key, dir: (c.dir * -1) as 1 | -1 } : { key, dir: -1 }));
  const shown = useMemo(() => {
    if (col) return [...creators].sort((a, b) => (a.n[col.key] - b.n[col.key]) * col.dir);
    // the order the page loaded them in is most recently added first
    return addedDir === -1 ? creators : [...creators].reverse();
  }, [creators, addedDir, col]);
  const lowToHigh = col ? col.dir === 1 : addedDir === 1;
  const isDate = !col;

  if (creators.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-[#F0F0F1] bg-white py-16 text-center shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <span className="flex size-12 items-center justify-center rounded-full bg-[#F0F0F1] text-[#6b6b69]">
          <MaterialIcon name="groups" size={24} />
        </span>
        <span className="text-[15px] font-extrabold">No creators yet</span>
        <span className="max-w-[320px] text-[13px] font-medium text-[#4a4a48]">Scan a creator or analyze a reel and they show up here.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="flex items-center gap-3 md:flex-wrap md:gap-2.5">
        <Dropdown
          prefix="Sort"
          value={col ? col.key : "latest"}
          onChange={(v) => {
            if (v === "latest") setCol(null);
            else setCol({ key: v as keyof CreatorCard["n"], dir: -1 });
          }}
          options={[
            { value: "latest", label: "Date Added" },
            { value: "posts", label: "Posts" },
            { value: "views", label: "Views" },
            { value: "comments", label: "Comments" },
            { value: "engagement", label: "Engagement" },
            ...(col?.key === "best" ? [{ value: "best", label: "Top Reel Views" }] : []),
            ...(col?.key === "mostComments" ? [{ value: "mostComments", label: "Top Reel Comments" }] : []),
          ]}
          className="min-w-0 flex-1 md:w-[210px] md:flex-none"
        />
        <button
          type="button"
          onClick={() => (col ? setCol({ key: col.key, dir: (col.dir * -1) as 1 | -1 }) : setAddedDir((d) => (d * -1) as 1 | -1))}
          title={isDate ? (lowToHigh ? "Oldest first" : "Newest first") : lowToHigh ? "Lowest first" : "Highest first"}
          aria-label={isDate ? (lowToHigh ? "Oldest first" : "Newest first") : lowToHigh ? "Lowest first" : "Highest first"}
          className="flex size-9 flex-none items-center justify-center text-[#0D0D0D] hover:text-[#FF1F8F]"
        >
          <MaterialIcon name={lowToHigh ? "arrow_upward" : "arrow_downward"} size={18} weight={500} />
        </button>
        <span className="ml-auto flex flex-none items-center gap-3">
          {viewToggle}
          <span className="text-[12px] font-semibold whitespace-nowrap text-[#6b6b69] md:text-[12.5px]">
            {shown.length} {shown.length === 1 ? "creator" : "creators"}
          </span>
        </span>
      </div>
      {shown.length === 0 && <div className="rounded-lg border border-[#F0F0F1] bg-white px-5 py-12 text-center text-sm font-medium text-[#4a4a48]">No creators match these filters.</div>}
      {view === "list" && shown.length > 0 && (
        <div className="overflow-hidden md:hidden rounded-xl border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          {shown.map((c) => (
            <Link key={c.username} href={`/creators/${encodeURIComponent(c.username)}`} className="group flex items-center gap-3 border-b border-[#F0F0F1] px-3.5 py-3 last:border-b-0 hover:bg-[#FBFBFA]">
              <span className="relative size-12 flex-none overflow-hidden rounded-full bg-[#2b2b29]">
                {c.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatar} alt="" className="absolute inset-0 size-full object-cover" />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[16px] font-extrabold">@{c.username}</span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] font-semibold text-[#4a4a48] [font-variant-numeric:tabular-nums]">
                  <span>{c.reels} {c.reels === 1 ? "post" : "posts"}</span>
                  <span className="flex items-center gap-1" title="Average views per reel"><MaterialIcon name="visibility" size={14} /> {c.avgViews}</span>
                  <span className="flex items-center gap-1" title="Average engagement"><MaterialIcon name="bolt" size={14} /> {c.avgEngagement}</span>
                </span>
              </div>
              <FavoriteCreator username={c.username} initial={c.favorite} size={22} className="size-9 flex-none" />
              <MaterialIcon name="chevron_right" size={22} className="flex-none text-[#9a9a98] group-hover:text-[#FF1F8F]" />
            </Link>
          ))}
        </div>
      )}
      {view === "list" && shown.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)] max-md:hidden">
          <div style={{ minWidth: 960 }}>
            <div className="grid items-center gap-2 border-b border-[#F0F0F1] bg-[#FBFBFA] px-6 py-2.5 text-xs font-bold text-[#4a4a48]" style={{ gridTemplateColumns: LIST_COLS }}>
              <span>Creator</span>
              {([
                ["posts", "stacks", "Posts pulled"],
                ["views", "visibility", "Average views"],
                ["comments", "comment", "Average comments"],
                ["engagement", "bolt", "Average engagement"],
              ] as const).map(([key, icon, tip]) => (
                <button key={key} type="button" onClick={() => pickCol(key)} title={tip} aria-label={tip} className="flex items-center justify-center justify-self-center gap-0.5 whitespace-nowrap text-[#0D0D0D] hover:text-[#FF1F8F]">
                  <MaterialIcon name={icon} size={18} weight={500} /> <MaterialIcon name={col?.key === key ? (col.dir === 1 ? "arrow_upward" : "arrow_downward") : "unfold_more"} size={15} />
                </button>
              ))}
              <button type="button" onClick={() => pickCol("best")} className="flex items-center justify-center justify-self-center gap-0.5 whitespace-nowrap text-[#0D0D0D] hover:text-[#FF1F8F]">
                Most Views <MaterialIcon name={col?.key === "best" ? (col.dir === 1 ? "arrow_upward" : "arrow_downward") : "unfold_more"} size={15} />
              </button>
              <button type="button" onClick={() => pickCol("mostComments")} className="flex items-center justify-center justify-self-center gap-0.5 whitespace-nowrap text-[#0D0D0D] hover:text-[#FF1F8F]">
                Most Comments <MaterialIcon name={col?.key === "mostComments" ? (col.dir === 1 ? "arrow_upward" : "arrow_downward") : "unfold_more"} size={15} />
              </button>
              <span />
            </div>
            {shown.map((c) => {
              const reelCell = (id: string, text: string) => (
                <Link href={id ? `/analyze-reel/reel/${id}` : `/creators/${encodeURIComponent(c.username)}`} prefetch={false} className="justify-self-center text-center hover:text-[#FF1F8F]">
                  {text}
                </Link>
              );
              return (
                <div key={c.username} className="grid items-center gap-2 border-b border-[#F0F0F1] px-6 py-2 text-[13px] font-normal text-[#0D0D0D] [font-variant-numeric:tabular-nums] last:border-b-0 hover:bg-[#FBFBFA]" style={{ gridTemplateColumns: LIST_COLS }}>
                  <Link href={`/creators/${encodeURIComponent(c.username)}`} className="flex min-w-0 items-center gap-3 hover:text-[#FF1F8F]">
                    <span className="relative size-10 flex-none overflow-hidden rounded-full bg-[#2b2b29]">
                      {c.avatar && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.avatar} alt="" className="absolute inset-0 size-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 text-sm font-medium break-words">@{c.username}</span>
                  </Link>
                  <span className="justify-self-center text-center">{c.reels}</span>
                  <span className="justify-self-center text-center">{c.avgViews}</span>
                  <span className="justify-self-center text-center">{c.avgComments}</span>
                  <span className="justify-self-center text-center font-semibold">{c.avgEngagement}</span>
                  {reelCell(c.bestId, c.bestViews)}
                  {reelCell(c.mostCommentsId, c.mostComments)}
                  <FavoriteCreator username={c.username} initial={c.favorite} size={20} className="size-9 justify-self-center" />
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:gap-6 ${view === "list" ? "hidden" : ""}`}>
        {shown.map((c) => (
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
                <span className="text-[12.5px] font-semibold text-[#4a4a48]">{c.reels} {c.reels === 1 ? "post" : "posts"}</span>
              </div>
              <span className="ml-auto flex items-center gap-1">
                <FavoriteCreator username={c.username} initial={c.favorite} size={22} className="size-9" />
                <MaterialIcon name="chevron_right" size={22} className="text-[#9a9a98] group-hover:text-[#FF1F8F]" />
              </span>
            </div>
            <div className="flex items-stretch gap-3">
              <span className="relative aspect-[3/4] w-[72px] flex-none overflow-hidden rounded-md bg-[#2b2b29]">
                <ReelCover url={c.bestThumb} showPlay={false} />
              </span>
              <div className="grid flex-1 grid-cols-[1fr_1.4fr] content-center gap-1.5">
                {(
                  [
                    ["visibility", "Avg views", c.avgViews, "Average views per reel"],
                    ["comment", "Avg comments", c.avgComments, "Average comments per reel"],
                    ["rocket_launch", "Best reel", c.bestViews, "Views on their most viewed reel"],
                    ["bolt", "Avg Engagement", c.avgEngagement, "Average engagement"],
                  ] as const
                ).map(([icon, label, v, tip]) => (
                  <span key={label} title={tip} className="flex min-w-0 flex-col gap-0.5 rounded-md bg-[#F6F6F5] px-2.5 py-1.5">
                    <span className="flex items-center gap-1 whitespace-nowrap text-[10.5px] font-bold text-[#6b6b69]">
                      <MaterialIcon name={icon} size={12} /> {label}
                    </span>
                    <span className="text-[14px] leading-none font-extrabold [font-variant-numeric:tabular-nums]">{v}</span>
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
