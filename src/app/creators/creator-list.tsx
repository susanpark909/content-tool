"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelCover } from "@/components/reel-thumb";
import { FavoriteCreator } from "./favorite-creator";
import { Dropdown } from "@/components/dropdown";
import { FilterPanel } from "@/components/filter-panel";
import { ExcludeCreators } from "@/components/exclude-creators";
import { useRememberedState } from "@/lib/use-remembered-state";

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
  favorite: boolean;
};

// Search your creators by name, then open one.
export function CreatorList({ creators }: { creators: CreatorCard[] }) {
  const [q, setQ] = useState("");
  const [favFilter, setFavFilter] = useState("all");
  const [postsFilter, setPostsFilter] = useState("any");
  const [picked, setPicked] = useState<string[]>([]);
  const names = useMemo(() => creators.map((c) => c.username).sort((a, b) => a.localeCompare(b)), [creators]);
  const [view, setView] = useRememberedState<"grid" | "list">("vh-creators-view", "grid");
  const onlyFavs = favFilter === "favs";
  const [sort, setSort] = useState("latest");
  const filterCount = (favFilter !== "all" ? 1 : 0) + (postsFilter !== "any" ? 1 : 0) + (picked.length > 0 ? 1 : 0);
  const matchesPosts = (n: number) => postsFilter === "any" || (postsFilter === "1" ? n === 1 : postsFilter === "2-5" ? n >= 2 && n <= 5 : n >= 6);
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase().replace(/^@/, "");
    const list = creators.filter((c) => (!query || c.username.toLowerCase().includes(query)) && (!onlyFavs || c.favorite) && matchesPosts(c.reels) && (picked.length === 0 || picked.includes(c.username)));
    // "latest" keeps the order the page loaded them in (most recently added first)
    if (sort === "most") return [...list].sort((a, b) => b.reels - a.reels);
    if (sort === "fewest") return [...list].sort((a, b) => a.reels - b.reels);
    if (sort === "name") return [...list].sort((a, b) => a.username.localeCompare(b.username));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creators, q, onlyFavs, postsFilter, picked, sort]);

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
      <div className="flex items-center gap-2.5">
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-[#E4E4E2] bg-white px-3.5 shadow-[0_4px_16px_rgba(13,13,13,0.06)] focus-within:border-[#0D0D0D]">
          <MaterialIcon name="search" size={20} className="text-[#4a4a48]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" autoComplete="off" className="min-w-0 flex-1 border-0 bg-transparent text-[14px] font-medium outline-none" />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="flex size-7 items-center justify-center rounded-md text-[#6b6b69] hover:bg-[#F0F0F1]">
              <MaterialIcon name="close" size={18} />
            </button>
          )}
        </div>
        <FilterPanel
          heightClass="h-11"
          count={filterCount}
          onClear={() => {
            setFavFilter("all");
            setPostsFilter("any");
            setPicked([]);
          }}
        >
          <div className="grid grid-cols-1 gap-2.5">
            <ExcludeCreators compact variant="include" creators={names} value={picked} onChange={setPicked} heightClass="h-10" className="w-full" />
            <Dropdown prefix="Favorites" value={favFilter} onChange={setFavFilter} options={[{ value: "all", label: "All" }, { value: "favs", label: "Favorites only", short: "Only" }]} className="w-full" />
            <Dropdown
              prefix="Posts scanned"
              value={postsFilter}
              onChange={setPostsFilter}
              options={[
                { value: "any", label: "Any" },
                { value: "1", label: "1 post", short: "1" },
                { value: "2-5", label: "2 to 5 posts", short: "2 to 5" },
                { value: "6+", label: "6 or more posts", short: "6 or more" },
              ]}
              className="w-full"
            />
          </div>
        </FilterPanel>
        <div className="flex h-11 flex-none overflow-hidden rounded-md border border-[#E4E4E2] bg-white">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              title={v === "grid" ? "Card view" : "List view"}
              aria-label={v === "grid" ? "Card view" : "List view"}
              className="flex w-11 items-center justify-center"
              style={{ background: view === v ? "#F0F0F1" : "#fff" }}
            >
              <MaterialIcon name={v === "grid" ? "grid_view" : "view_list"} size={20} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 md:flex-wrap md:gap-2.5">
        <Dropdown
          prefix="Sort"
          value={sort}
          onChange={setSort}
          options={[
            { value: "latest", label: "Recently added", short: "Recent" },
            { value: "most", label: "Most posts scanned", short: "Most posts" },
            { value: "fewest", label: "Fewest posts scanned", short: "Fewest posts" },
            { value: "name", label: "Name A to Z", short: "A to Z" },
          ]}
          className="min-w-0 flex-1 md:w-[210px] md:flex-none"
        />
        <span className="ml-auto flex-none text-[12px] font-semibold whitespace-nowrap text-[#6b6b69] md:text-[12.5px]">
          {shown.length} {shown.length === 1 ? "creator" : "creators"}
        </span>
      </div>
      {shown.length === 0 && <div className="rounded-lg border border-[#F0F0F1] bg-white px-5 py-12 text-center text-sm font-medium text-[#4a4a48]">{onlyFavs && !q ? "No favorite creators yet. Tap the heart on a creator." : `No creators match “${q}”.`}</div>}
      {view === "list" && shown.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
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
                  <span className="flex items-center gap-1" title="Average engagement rate"><MaterialIcon name="forum" size={14} /> {c.avgEngagement}</span>
                </span>
              </div>
              <FavoriteCreator username={c.username} initial={c.favorite} size={22} className="size-9 flex-none" />
              <MaterialIcon name="chevron_right" size={22} className="flex-none text-[#9a9a98] group-hover:text-[#FF1F8F]" />
            </Link>
          ))}
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
              <div className="grid flex-1 grid-cols-2 content-center gap-1.5">
                {(
                  [
                    ["visibility", "Avg views", c.avgViews, "Average views per reel"],
                    ["comment", "Avg comments", c.avgComments, "Average comments per reel"],
                    ["rocket_launch", "Best reel", c.bestViews, "Views on their most viewed reel"],
                    ["forum", "Engagement rate", c.avgEngagement, "Average engagement rate (comments ÷ views)"],
                  ] as const
                ).map(([icon, label, v, tip]) => (
                  <span key={label} title={tip} className="flex min-w-0 flex-col gap-0.5 rounded-md bg-[#F6F6F5] px-2.5 py-1.5">
                    <span className="flex items-center gap-1 truncate text-[10.5px] font-bold text-[#6b6b69]">
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
