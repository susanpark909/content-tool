"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelCover } from "@/components/reel-thumb";
import { FavoriteCreator } from "./favorite-creator";

export type CreatorCard = {
  username: string;
  avatar: string | null;
  reels: number;
  avgViews: string;
  avgComments: string;
  avgLikes: string;
  bestThumb: string | null;
  favorite: boolean;
};

// Search your creators by name, then open one.
export function CreatorList({ creators }: { creators: CreatorCard[] }) {
  const [q, setQ] = useState("");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase().replace(/^@/, "");
    return creators.filter((c) => (!query || c.username.toLowerCase().includes(query)) && (!onlyFavs || c.favorite));
  }, [creators, q, onlyFavs]);

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
      <div className="flex h-11 items-center gap-2.5 rounded-lg border border-[#E4E4E2] bg-white px-3.5 shadow-[0_4px_16px_rgba(13,13,13,0.06)] focus-within:border-[#0D0D0D]">
        <MaterialIcon name="search" size={20} className="text-[#4a4a48]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search creators…" autoComplete="off" className="min-w-0 flex-1 border-0 bg-transparent text-[14px] font-medium outline-none" />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="flex size-7 items-center justify-center rounded-md text-[#6b6b69] hover:bg-[#F0F0F1]">
            <MaterialIcon name="close" size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOnlyFavs((v) => !v)}
          title="Show only my favorite creators"
          className="flex h-8 flex-none items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-bold hover:border-[#0D0D0D]"
          style={{ background: onlyFavs ? "#F0F0F1" : "#fff", borderColor: onlyFavs ? "#0D0D0D" : "#E4E4E2" }}
        >
          <span className="msym select-none" style={{ fontSize: 17, color: "#FF1F8F", fontVariationSettings: `'FILL' ${onlyFavs ? 1 : 0}, 'wght' 400` }} aria-hidden="true">favorite</span>
          Favorites
        </button>
        <span className="hidden text-[12.5px] font-semibold text-[#6b6b69] sm:block">
          {shown.length} {shown.length === 1 ? "creator" : "creators"}
        </span>
      </div>
      {shown.length === 0 && <div className="rounded-lg border border-[#F0F0F1] bg-white px-5 py-12 text-center text-sm font-medium text-[#4a4a48]">{onlyFavs && !q ? "No favorite creators yet. Tap the heart on a creator." : `No creators match “${q}”.`}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:gap-6">
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
              <div className="grid flex-1 grid-cols-1 content-center gap-1.5 text-[12.5px] font-bold">
                {(
                  [
                    ["visibility", "Avg views", c.avgViews],
                    ["comment", "Avg comments", c.avgComments],
                    ["favorite", "Avg likes", c.avgLikes],
                  ] as const
                ).map(([icon, label, v]) => (
                  <span key={label} className="flex items-center justify-between rounded-md bg-[#F6F6F5] px-2.5 py-1.5">
                    <span className="flex items-center gap-1 text-[#4a4a48]">
                      <MaterialIcon name={icon} size={14} /> {label}
                    </span>
                    {v}
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
