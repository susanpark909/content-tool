"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRememberedState } from "@/lib/use-remembered-state";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { deleteCreators } from "./creator-actions";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelCover } from "@/components/reel-thumb";
import { FavoriteCreator } from "./favorite-creator";
import { Dropdown } from "@/components/dropdown";
import { SortControl } from "@/components/sort-control";

const LIST_COLS = "28px minmax(240px,1.3fr) repeat(8, minmax(96px,1fr)) 48px";

export type CreatorCard = {
  username: string;
  avatar: string | null;
  reels: number;
  avgViews: string;
  avgComments: string;
  avgLikes: string;
  avgShares: string;
  mostShares: string;
  mostSharesId: string;
  avgEngagement: string;
  avgShareRate: string;
  bestViews: string;
  bestThumb: string | null;
  bestId: string;
  mostComments: string;
  mostCommentsThumb: string | null;
  mostCommentsId: string;
  // raw numbers, for sorting
  n: { posts: number; views: number; comments: number; shares: number; mostShares: number; engagement: number; best: number; mostComments: number };
  favorite: boolean;
};

// The same checkbox the Posts list uses: black when ticked, a dash when only some are.
function Box({ on, some }: { on: boolean; some?: boolean }) {
  const filled = on || !!some;
  return (
    <span className="flex size-4 flex-none items-center justify-center rounded-[3px] border-[1.5px]" style={{ background: filled ? "#0D0D0D" : "#FFFFFF", borderColor: filled ? "#0D0D0D" : "#BDBDBB" }}>
      {filled && <MaterialIcon name={on ? "check" : "remove"} size={12} className="text-white" />}
    </span>
  );
}

// The creator cards / list. Search and filters live in the Library bar above, so Posts and Creators always agree.
export function CreatorList({ creators, view, viewToggle }: { creators: CreatorCard[]; view: "grid" | "list"; viewToggle: React.ReactNode }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (u: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(u)) next.delete(u);
      else next.add(u);
      return next;
    });
  // the sort is remembered, so hearting a creator (or leaving and coming back) never resets it
  const [addedDir, setAddedDir] = useRememberedState<1 | -1>("vh-creators-addedDir", -1);
  // clicking a column header sorts by it (the Sort menu above is cleared)
  const [col, setCol] = useRememberedState<{ key: keyof CreatorCard["n"]; dir: 1 | -1 } | null>("vh-creators-sort", null);
  const pickCol = (key: keyof CreatorCard["n"]) => setCol(col && col.key === key ? { key, dir: (col.dir * -1) as 1 | -1 } : { key, dir: -1 });
  const shown = useMemo(() => {
    if (col) return [...creators].sort((a, b) => (a.n[col.key] - b.n[col.key]) * col.dir);
    // the order the page loaded them in is most recently added first
    return addedDir === -1 ? creators : [...creators].reverse();
  }, [creators, addedDir, col]);
  const allOn = shown.length > 0 && shown.every((c) => selected.has(c.username));
  const someOn = !allOn && shown.some((c) => selected.has(c.username));
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(shown.map((c) => c.username)));
  const pickedCreators = shown.filter((c) => selected.has(c.username));
  const pickedPosts = pickedCreators.reduce((n, c) => n + c.reels, 0);
  async function removePicked() {
    setBusy(true);
    setError(null);
    try {
      await deleteCreators(pickedCreators.map((c) => c.username));
      setSelected(new Set());
      setConfirming(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete these creators");
    }
    setBusy(false);
  }
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 md:gap-2.5">
        <div className="basis-full md:hidden">
          <SortControl
            fill
            options={[
              { value: "latest", label: "Date added" },
              { value: "posts", label: "Posts" },
              { value: "views", label: "Views" },
              { value: "comments", label: "Comments" },
            { value: "shares", label: "Shares" },
              { value: "shares", label: "Shares" },
              { value: "engagement", label: "Engagement rate" },
              ...(col?.key === "best" ? [{ value: "best", label: "Top reel views" }] : []),
              ...(col?.key === "mostComments" ? [{ value: "mostComments", label: "Top reel comments" }] : []),
            ]}
            value={col ? col.key : "latest"}
            onChange={(v) => {
              if (v === "latest") setCol(null);
              else setCol({ key: v as keyof CreatorCard["n"], dir: -1 });
            }}
            asc={lowToHigh}
            onToggleAsc={() => (col ? setCol({ key: col.key, dir: (col.dir * -1) as 1 | -1 }) : setAddedDir((addedDir * -1) as 1 | -1))}
            dateKeys={["latest"]}
          />
        </div>
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
          className="min-w-0 flex-1 max-md:hidden md:w-[210px] md:flex-none"
        />
        <button
          type="button"
          onClick={() => (col ? setCol({ key: col.key, dir: (col.dir * -1) as 1 | -1 }) : setAddedDir((addedDir * -1) as 1 | -1))}
          title={isDate ? (lowToHigh ? "Oldest first" : "Newest first") : lowToHigh ? "Lowest first" : "Highest first"}
          aria-label={isDate ? (lowToHigh ? "Oldest first" : "Newest first") : lowToHigh ? "Lowest first" : "Highest first"}
          className="flex size-9 max-md:hidden flex-none items-center justify-center text-[#0D0D0D] hover:text-[#FF1F8F]"
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
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[#F0F0F1] bg-white px-4 py-2.5 text-[13px] font-semibold shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          <span className="font-extrabold whitespace-nowrap">{selected.size} selected</span>
          <button type="button" onClick={() => { setError(null); setConfirming(true); }} className="flex h-9 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-3 font-bold text-[#D10A6E] hover:border-[#D10A6E] hover:bg-[#FFF0F7]">
            <MaterialIcon name="delete" size={17} /> Delete
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="flex h-9 items-center gap-1.5 rounded-md px-2 font-bold hover:text-[#FF1F8F]">
            <MaterialIcon name="deselect" size={17} /> Clear selection
          </button>
        </div>
      )}
      {shown.length > 0 && (
        <button type="button" onClick={toggleAll} aria-label="Select all creators" className={`flex items-center gap-2.5 self-start text-xs font-bold text-[#4a4a48] ${view === "list" ? "md:hidden" : ""}`}>
          <Box on={allOn} some={someOn} /> Select all
        </button>
      )}
      {shown.length === 0 && <div className="rounded-lg border border-[#F0F0F1] bg-white px-5 py-12 text-center text-sm font-medium text-[#4a4a48]">No creators match these filters.</div>}
      {view === "list" && shown.length > 0 && (
        <div className="overflow-hidden md:hidden rounded-xl border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          {shown.map((c) => (
            <div key={c.username} className="relative flex flex-col gap-2.5 border-b border-[#F0F0F1] px-3.5 py-3 last:border-b-0" style={{ background: selected.has(c.username) ? "#F0F0F1" : "#FFFFFF" }}>
              <Link href={`/creators/${encodeURIComponent(c.username)}`} aria-label={`@${c.username}`} className="absolute inset-0 z-0" />
              <div className="pointer-events-none relative flex items-center gap-3">
                <button type="button" onClick={() => toggle(c.username)} aria-label={`Select @${c.username}`} className="pointer-events-auto relative z-10 flex size-9 flex-none items-center justify-center">
                  <Box on={selected.has(c.username)} />
                </button>
                <span className="relative size-11 flex-none overflow-hidden rounded-full bg-[#2b2b29]">
                  {c.avatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar} alt="" className="absolute inset-0 size-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1 text-[16px] font-extrabold break-words">@{c.username}</span>
                <FavoriteCreator username={c.username} initial={c.favorite} size={22} className="pointer-events-auto relative z-10 size-9 flex-none" />
              </div>
              <div className="pointer-events-none relative grid grid-cols-4 gap-1.5 [font-variant-numeric:tabular-nums]">
                {(
                  [
                    ["Posts", String(c.reels)],
                    ["Avg Views", c.avgViews],
                    ["Avg Comments", c.avgComments],
                    ["Avg Shares", c.avgShares],
                    ["Avg Engagement", c.avgEngagement],
                    ["Most Views", c.bestViews],
                    ["Most Comments", c.mostComments],
                    ["Most Shares", c.mostShares],
                  ] as const
                ).map(([label, v]) => (
                  <span key={label} className="flex min-w-0 flex-col gap-0.5 rounded-md bg-[#F6F6F5] px-2 py-1.5">
                    <span className="text-[10.5px] leading-tight font-bold text-[#6b6b69]">{label}</span>
                    <span className="text-[14px] leading-none font-extrabold whitespace-nowrap">{v}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {view === "list" && shown.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)] max-md:hidden">
          <div style={{ minWidth: 1140 }}>
            <div className="grid items-center gap-2 border-b border-[#F0F0F1] bg-[#FBFBFA] px-6 py-2.5 text-xs font-bold text-[#4a4a48]" style={{ gridTemplateColumns: LIST_COLS }}>
              <button type="button" onClick={toggleAll} aria-label="Select all creators"><Box on={allOn} some={someOn} /></button>
              <span>Creator</span>
              {([
                ["posts", "stacks", "Posts pulled"],
                ["views", "visibility", "Average views"],
                ["comments", "comment", "Average comments"],
                ["shares", "send", "Average shares"],
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
              <button type="button" onClick={() => pickCol("mostShares")} className="flex items-center justify-center justify-self-center gap-0.5 whitespace-nowrap text-[#0D0D0D] hover:text-[#FF1F8F]">
                Most Shares <MaterialIcon name={col?.key === "mostShares" ? (col.dir === 1 ? "arrow_upward" : "arrow_downward") : "unfold_more"} size={15} />
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
                <div key={c.username} className="grid items-center gap-2 border-b border-[#F0F0F1] px-6 py-2 text-[13px] font-normal text-[#0D0D0D] [font-variant-numeric:tabular-nums] last:border-b-0" style={{ gridTemplateColumns: LIST_COLS, background: selected.has(c.username) ? "#F0F0F1" : "#FFFFFF" }}>
                  <button type="button" onClick={() => toggle(c.username)} aria-label={`Select @${c.username}`}><Box on={selected.has(c.username)} /></button>
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
                  <span className="justify-self-center text-center">{c.avgShares}</span>
                  <span className="justify-self-center text-center font-semibold">{c.avgEngagement}</span>
                  {reelCell(c.bestId, c.bestViews)}
                  {reelCell(c.mostCommentsId, c.mostComments)}
                  {reelCell(c.mostSharesId, c.mostShares)}
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
            style={{ background: selected.has(c.username) ? "#F0F0F1" : "#FFFFFF" }}
            className="group flex flex-col gap-4 rounded-xl border border-[#F0F0F1] p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(13,13,13,0.16)]"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggle(c.username);
                }}
                aria-label={`Select @${c.username}`}
                className="flex size-9 flex-none items-center justify-center"
              >
                <Box on={selected.has(c.username)} />
              </button>
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
                    ["send", "Avg shares", c.avgShares, "Average shares per reel"],
                    ["bolt", "Avg Engagement", c.avgEngagement, "Average engagement"],
                    ["rocket_launch", "Best reel", c.bestViews, "Views on their most viewed reel"],
                    ["send", "Top shares", c.mostShares, "Shares on their most shared reel"],
                  ] as const
                ).map(([icon, label, v, tip]) => (
                  <span key={label} title={tip} className="flex min-w-0 flex-col gap-0.5 rounded-md bg-[#F6F6F5] px-2.5 py-1.5">
                    <span className="flex items-center gap-1 whitespace-nowrap text-[10.5px] font-bold text-[#6b6b69]">
                      <MaterialIcon name={icon} size={12} /> {label}
                    </span>
                    <span className="text-[14px] leading-none font-extrabold whitespace-nowrap [font-variant-numeric:tabular-nums]">{v}</span>
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {confirming && (
        <div onClick={() => !busy && setConfirming(false)} className="fixed inset-0 z-[110] flex items-center justify-center bg-[rgba(13,13,13,0.35)] p-4 backdrop-blur-[6px]">
          <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[440px] flex-col gap-4 rounded-2xl border border-[#F0F0F1] bg-white p-5 shadow-[0_24px_72px_rgba(13,13,13,0.28)]">
            <span className="text-[22px] font-extrabold tracking-[-0.01em]">Delete {pickedCreators.length} {pickedCreators.length === 1 ? "Creator" : "Creators"}?</span>
            <span className="text-[14px] leading-snug font-medium text-[#4a4a48]">
              This removes {pickedCreators.length === 1 ? "this creator" : "these creators"} and all {pickedPosts} {pickedPosts === 1 ? "post" : "posts"} saved for them, including analyses, types and board spots. It can&apos;t be undone.
            </span>
            {error && <span className="text-[13px] font-semibold text-[#D10A6E]">{error}</span>}
            <div className="flex justify-end gap-2.5">
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="flex h-10 items-center rounded-md border border-[#E4E4E2] px-4 text-[13.5px] font-bold hover:border-[#0D0D0D]">
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={removePicked} className="flex h-10 items-center gap-1.5 rounded-md bg-[#0D0D0D] px-4 text-[13.5px] font-extrabold text-white hover:bg-[#D10A6E] disabled:opacity-70">
                {busy ? <EqualizerIcon size={15} /> : <MaterialIcon name="delete" size={17} />}
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
