"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelThumb } from "@/components/reel-thumb";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { BackLink } from "@/components/back-link";
import { Dropdown } from "@/components/dropdown";
import { OutlierBadge } from "@/components/outlier-filter";
import { useRememberedState } from "@/lib/use-remembered-state";
import { analyzeSingleReel } from "@/app/analyze-reel/actions";
import { MIN_REELS_FOR_OUTLIER, OUTLIER_GOALS, outlierOf, typicalByGoal, type OutlierGoal } from "@/lib/outlier";

export type CreatorReel = {
  id: string;
  url: string;
  caption: string;
  thumbnailUrl: string | null;
  postedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  reposts: number | null;
  saves: number | null;
  durationSeconds: number | null;
  analyzed: boolean;
};

const fmtN = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k" : String(Math.round(n)));
const avgOf = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const pct = (n: number | null, d: number) => (n == null || d <= 0 ? null : (n / d) * 100);
const fmtPct = (x: number | null) => (x == null ? "—" : x.toFixed(x >= 10 ? 1 : 2) + "%");
const fmtLen = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—");
const optN = (n: number | null) => (n == null ? "—" : fmtN(n));

type SortKey = "posted" | "views" | "likes" | "comments" | "shares" | "reposts" | "saves" | "length" | "engagement" | "shareRate" | "outlier";
const GRID = "grid-cols-[28px_minmax(260px,1fr)_88px_70px_76px_70px_76px_68px_68px_68px_92px_92px_104px_118px]";
const PAGE = 200;

const TIP_ANALYZED = "Analyzed means it's been transcribed, with the hook and CTA pulled out and organized.";
const TIP_SCANNED = "Scanned means views, likes, comments, date and length only. Analyze it to get the transcript, hook and CTA.";

function StatusTag({ analyzed }: { analyzed: boolean }) {
  return (
    <span className="group relative flex w-fit">
      <span
        className="flex items-center gap-1 rounded-[10px] px-2 py-0.5 text-[11.5px] font-bold"
        style={{ background: analyzed ? "#EAF8D8" : "#F0F0F1", color: analyzed ? "#3a8a00" : "#4a4a48" }}
      >
        <MaterialIcon name={analyzed ? "check_circle" : "radar"} size={13} /> {analyzed ? "Analyzed" : "Scanned"}
      </span>
      <span className="pointer-events-none absolute right-0 bottom-full z-30 mb-1.5 w-[250px] rounded-lg bg-[#0D0D0D] px-3 py-2 text-[12px] leading-snug font-semibold whitespace-normal text-white opacity-0 shadow-[0_8px_24px_rgba(13,13,13,0.25)] transition-opacity group-hover:opacity-100">
        {analyzed ? TIP_ANALYZED : TIP_SCANNED}
      </span>
    </span>
  );
}

export function CreatorClient({ username, avatar, reels }: { username: string; avatar: string | null; reels: CreatorReel[] }) {
  const router = useRouter();
  const key = (s: string) => `vh-creator-${username}-${s}`;
  const [view, setView] = useRememberedState<"list" | "board">("vh-creator-view", "list");
  const [goal, setGoal] = useRememberedState<OutlierGoal>(key("goal"), "views");
  const [sort, setSort] = useRememberedState<{ key: SortKey; dir: 1 | -1 }>(key("sort"), { key: "posted", dir: -1 });
  const [status, setStatus] = useRememberedState<string>(key("status"), "all");
  const [minEng, setMinEng] = useRememberedState<string>(key("eng"), "0");
  const [minShare, setMinShare] = useRememberedState<string>(key("share"), "0");
  const [minOutlier, setMinOutlier] = useRememberedState<string>(key("outlier"), "0");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typical = useMemo(() => typicalByGoal(reels.map((r) => ({ views: r.views, comments: r.comments, shares: r.shares }))), [reels]);
  const goalMeta = OUTLIER_GOALS.find((g) => g.key === goal)!;
  const enough = typical[goal] != null;

  const rows = useMemo(() => {
    const base = reels.map((r) => ({
      r,
      eng: pct(r.comments, r.views),
      share: pct(r.reposts, r.views),
      out: outlierOf({ views: r.views, comments: r.comments, shares: r.shares }, goal, typical),
    }));
    const query = q.trim().toLowerCase();
    const filtered = base.filter(
      (x) =>
        (status === "all" || (status === "analyzed") === x.r.analyzed) &&
        (Number(minEng) === 0 || (x.eng ?? -1) >= Number(minEng)) &&
        (Number(minShare) === 0 || (x.share ?? -1) >= Number(minShare)) &&
        (Number(minOutlier) === 0 || (x.out ?? -1) >= Number(minOutlier)) &&
        (!query || x.r.caption.toLowerCase().includes(query)),
    );
    const val = (x: (typeof base)[number]): number =>
      sort.key === "posted" ? (x.r.postedAt ? new Date(x.r.postedAt).getTime() : 0)
        : sort.key === "views" ? x.r.views
        : sort.key === "likes" ? x.r.likes
        : sort.key === "comments" ? x.r.comments
        : sort.key === "shares" ? (x.r.shares ?? -1)
        : sort.key === "reposts" ? (x.r.reposts ?? -1)
        : sort.key === "saves" ? (x.r.saves ?? -1)
        : sort.key === "length" ? (x.r.durationSeconds ?? -1)
        : sort.key === "engagement" ? (x.eng ?? -1)
        : sort.key === "shareRate" ? (x.share ?? -1)
        : (x.out ?? -1);
    return filtered.sort((a, b) => (val(a) - val(b)) * sort.dir);
  }, [reels, goal, typical, q, status, minEng, minShare, minOutlier, sort]);

  const analyzedCount = reels.filter((r) => r.analyzed).length;
  const best = reels.reduce((m, r) => (r.views > m.views ? r : m), reels[0]);
  const filtersOn = q !== "" || status !== "all" || minEng !== "0" || minShare !== "0" || minOutlier !== "0";
  const toAnalyze = reels.filter((r) => picked.has(r.id) && !r.analyzed);
  const shownRows = rows.slice(0, limit);

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function head(k: SortKey, label: string, icon?: string, tip?: string, suffix?: string) {
    const on = sort.key === k;
    return (
      <button
        type="button"
        title={tip ?? label}
        onClick={() => setSort(on ? { key: k, dir: (sort.dir * -1) as 1 | -1 } : { key: k, dir: -1 })}
        className={`flex items-center justify-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F] ${on ? "text-[#0D0D0D]" : ""}`}
      >
        {icon ? <MaterialIcon name={icon} size={16} /> : label}
        {suffix && <span className="text-[11px] font-extrabold">{suffix}</span>}
        <span className="text-[10px]">{on ? (sort.dir === 1 ? "↑" : "↓") : "↕"}</span>
      </button>
    );
  }

  async function analyzePicked() {
    if (toAnalyze.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("reelUrl", toAnalyze.map((r) => r.url).join("\n"));
      await analyzeSingleReel(fd);
      setPicked(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof TypeError ? "Lost the connection. It may have finished, so refresh to check." : e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const engOptions = [{ value: "0", label: "Any" }, { value: "0.05", label: "0.05%+" }, { value: "0.1", label: "0.1%+" }, { value: "0.25", label: "0.25%+" }, { value: "0.5", label: "0.5%+" }, { value: "1", label: "1%+" }];
  const shareOptions = [{ value: "0", label: "Any" }, { value: "0.05", label: "0.05%+" }, { value: "0.1", label: "0.1%+" }, { value: "0.25", label: "0.25%+" }, { value: "0.5", label: "0.5%+" }];
  const outOptions = [{ value: "0", label: "Any" }, { value: "1.5", label: "1.5x+" }, { value: "2", label: "2x+" }, { value: "3", label: "3x+" }, { value: "5", label: "5x+" }, { value: "10", label: "10x+" }];

  const caption = (r: CreatorReel, cls: string) =>
    r.analyzed ? (
      <Link href={`/analyze-reel/reel/${r.id}`} className={`${cls} hover:text-[#FF1F8F]`}>
        {r.caption.split("\n")[0] || "(no caption)"}
      </Link>
    ) : (
      <span className={cls}>{r.caption.split("\n")[0] || "(no caption)"}</span>
    );

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <BackLink fallbackHref="/creators" label="Back to Creators" />

      <div className="flex flex-wrap items-center gap-4">
        <span className="relative size-[72px] flex-none overflow-hidden rounded-full bg-[#2b2b29] md:size-[88px]">
          {avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="absolute inset-0 size-full object-cover" />
          )}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[28px] leading-[1] font-black tracking-[-0.03em] md:text-[44px]">
            @{username}
            <span className="ml-1 inline-block size-2 rounded-full bg-[#C6FF3D] align-baseline md:size-2.5" />
          </h1>
          <a href={`https://www.instagram.com/${username}/`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-[#4a4a48] hover:text-[#FF1F8F]">
            Open on Instagram <MaterialIcon name="open_in_new" size={14} />
          </a>
        </div>
        <div className="ml-auto grid grid-cols-3 gap-2 text-[12.5px] font-bold md:grid-cols-6">
          {[
            ["Reels", String(reels.length)],
            ["Analyzed", String(analyzedCount)],
            ["Avg views", fmtN(avgOf(reels.map((r) => r.views)))],
            ["Avg comments", fmtN(avgOf(reels.map((r) => r.comments)))],
            ["Avg likes", fmtN(avgOf(reels.filter((r) => r.likes >= 0).map((r) => r.likes)))],
            ["Best reel", fmtN(best.views)],
          ].map(([l, v]) => (
            <span key={l} title={l === "Analyzed" ? TIP_ANALYZED : undefined} className="flex min-w-[88px] flex-col rounded-lg border border-[#F0F0F1] bg-white px-3 py-2 shadow-[0_4px_16px_rgba(13,13,13,0.06)]">
              <span className="text-[10.5px] font-extrabold tracking-wide text-[#6b6b69] uppercase">{l}</span>
              <span className="text-[18px] font-black">{v}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#F0F0F1] bg-white p-2.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-md border border-[#E4E4E2] px-2.5 focus-within:border-[#0D0D0D]">
          <MaterialIcon name="search" size={17} className="text-[#4a4a48]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search captions…" autoComplete="off" className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium outline-none" />
        </div>
        <Dropdown prefix="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "All" }, { value: "scanned", label: "Scanned" }, { value: "analyzed", label: "Analyzed" }]} className="w-[150px]" />
        <Dropdown prefix="Engagement" value={minEng} onChange={setMinEng} options={engOptions} className="w-[170px]" />
        <Dropdown prefix="Share rate" value={minShare} onChange={setMinShare} options={shareOptions} className="w-[160px]" />
        <div className="flex h-9 overflow-hidden rounded-md border border-[#E4E4E2]" title="Which goal the outlier score is measured on">
          {OUTLIER_GOALS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGoal(g.key)}
              className="flex items-center gap-1 px-2.5 text-[12.5px] font-bold hover:text-[#FF1F8F]"
              style={{ background: goal === g.key ? "#F0F0F1" : undefined }}
            >
              <MaterialIcon name={g.icon} size={15} className={goal === g.key ? "text-[#FF1F8F]" : undefined} />
              {g.label}
            </button>
          ))}
        </div>
        <Dropdown prefix="Outlier" value={minOutlier} onChange={setMinOutlier} options={outOptions} className="w-[130px]" />
        <button
          type="button"
          disabled={!filtersOn}
          onClick={() => {
            setQ("");
            setStatus("all");
            setMinEng("0");
            setMinShare("0");
            setMinOutlier("0");
          }}
          className="flex h-9 items-center gap-1 rounded-md border border-[#E4E4E2] px-2.5 text-[12px] font-bold text-[#D10A6E] hover:border-[#D10A6E] disabled:text-[#9a9a98] disabled:hover:border-[#E4E4E2]"
        >
          <MaterialIcon name="filter_alt_off" size={15} /> Clear
        </button>
        <div className="flex h-9 overflow-hidden rounded-md border border-[#E4E4E2] bg-white md:ml-auto">
          {(["list", "board"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              title={v === "list" ? "List view" : "Board view: analyzed vs not yet"}
              aria-label={v === "list" ? "List view" : "Board view"}
              className="flex w-10 items-center justify-center hover:text-[#FF1F8F]"
              style={{ background: view === v ? "#F0F0F1" : undefined }}
            >
              <MaterialIcon name={v === "list" ? "view_list" : "grid_view"} size={19} />
            </button>
          ))}
        </div>
        <span className="w-full text-[12px] font-semibold text-[#4a4a48]">
          {rows.length} {rows.length === 1 ? "reel" : "reels"}
          {filtersOn ? " match" : ""}
          {!enough && ` · ${goalMeta.label} outlier needs at least ${MIN_REELS_FOR_OUTLIER} reels with ${goal === "shares" ? "share counts (analyze more)" : "numbers"}`}
        </span>
      </div>

      {picked.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-lg bg-[#0D0D0D] px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_12px_32px_rgba(13,13,13,0.25)]">
          <span>{picked.size} selected</span>
          <button type="button" onClick={() => setPicked(new Set())} className="text-[12.5px] text-[#BDBDBB] hover:text-white">
            Clear
          </button>
          <button
            type="button"
            disabled={busy || toAnalyze.length === 0}
            onClick={analyzePicked}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-md bg-[#FF1F8F] px-4 text-[13px] font-extrabold text-[#0D0D0D] hover:bg-white disabled:opacity-60"
          >
            {busy ? <EqualizerIcon size={15} /> : <MaterialIcon name="bolt" size={17} weight={500} />}
            {busy ? "Analyzing…" : toAnalyze.length === 0 ? "Already analyzed" : `Analyze (${toAnalyze.length})`}
          </button>
        </div>
      )}
      {error && <p className="text-[13px] font-semibold text-[#D10A6E]">{error}</p>}

      {view === "list" ? (
        <div className="overflow-x-auto rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          <div className="min-w-[1420px]">
            <div className={`grid ${GRID} items-center gap-3 border-b border-[#CFCFCD] px-4 py-3 text-xs font-bold text-[#4a4a48]`}>
              <input
                type="checkbox"
                aria-label="Select all shown"
                checked={shownRows.length > 0 && shownRows.every((x) => picked.has(x.r.id))}
                onChange={(e) => setPicked(e.target.checked ? new Set(shownRows.map((x) => x.r.id)) : new Set())}
                className="size-4 cursor-pointer accent-[#FF1F8F]"
              />
              <span>Post</span>
              {head("posted", "Posted")}
              {head("length", "Length", "av_timer", "Length")}
              {head("views", "Views", "visibility", "Views")}
              {head("likes", "Likes", "favorite", "Likes")}
              {head("comments", "Comments", "comment", "Comments")}
              {head("shares", "Shares", "send", "Shares (appear once analyzed)")}
              {head("reposts", "Reposts", "repeat", "Reposts (appear once analyzed)")}
              {head("saves", "Saves", "bookmark", "Saves (appear once analyzed)")}
              {head("engagement", "Engagement", "comment", "Engagement rate (comments ÷ views)", "%")}
              {head("shareRate", "Share Rate", "repeat", "Share rate (reposts ÷ views)", "%")}
              {head("outlier", `${goalMeta.label} Outlier`, "rocket_launch", `${goalMeta.label} outlier: how many times the creator's typical reel`)}
              <span>Status</span>
            </div>
            {rows.length === 0 && <div className="px-5 py-12 text-center text-sm font-medium text-[#4a4a48]">No reels match these filters.</div>}
            {shownRows.map(({ r, eng, share, out }) => (
              <div key={r.id} className={`grid ${GRID} items-center gap-3 border-b border-[#F0F0F1] px-4 py-2.5 text-[13px] font-semibold last:border-b-0 hover:bg-[#FBFBFA]`} style={{ background: picked.has(r.id) ? "#FBFBFA" : undefined }}>
                <input type="checkbox" checked={picked.has(r.id)} onChange={() => togglePick(r.id)} className="size-4 cursor-pointer accent-[#FF1F8F]" />
                <div className="flex min-w-0 items-center gap-3">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" title="Open on Instagram" className="flex-none">
                    <ReelThumb url={r.thumbnailUrl} />
                  </a>
                  {caption(r, "line-clamp-2 min-w-0 text-[13.5px] leading-[1.3] font-bold")}
                </div>
                <span className="text-center text-[#4a4a48]">{fmtDate(r.postedAt)}</span>
                <span className="text-center">{fmtLen(r.durationSeconds)}</span>
                <span className="text-center">{fmtN(r.views)}</span>
                <span className="text-center">{r.likes < 0 ? "—" : fmtN(r.likes)}</span>
                <span className="text-center">{fmtN(r.comments)}</span>
                <span className="text-center">{optN(r.shares)}</span>
                <span className="text-center">{optN(r.reposts)}</span>
                <span className="text-center">{optN(r.saves)}</span>
                <span className="text-center">{fmtPct(eng)}</span>
                <span className="text-center">{fmtPct(share)}</span>
                <span className="flex justify-center">{out == null ? <span className="text-[#9a9a98]">—</span> : <OutlierBadge value={out} metric={goal} />}</span>
                <StatusTag analyzed={r.analyzed} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            { key: false, title: "Not Analyzed Yet", icon: "radar", tint: "#F4F4F3", bg: "#E8E8E6", fg: "#4a4a48", tip: TIP_SCANNED },
            { key: true, title: "Analyzed", icon: "check_circle", tint: "#F5FBEC", bg: "#EAF8D8", fg: "#3a8a00", tip: TIP_ANALYZED },
          ].map((col) => {
            const items = rows.filter((x) => x.r.analyzed === col.key);
            const shown = items.slice(0, limit);
            return (
              <div key={String(col.key)} className="flex min-h-[260px] flex-col gap-3 rounded-2xl p-3" style={{ background: col.tint }}>
                <div className="flex items-center gap-2 px-1 pt-0.5" title={col.tip}>
                  <span className="flex size-8 flex-none items-center justify-center rounded-lg" style={{ background: col.bg, color: col.fg }}>
                    <MaterialIcon name={col.icon} size={18} />
                  </span>
                  <span className="text-[15px] font-extrabold tracking-[-0.01em]">{col.title}</span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-extrabold shadow-[0_1px_4px_rgba(13,13,13,0.08)]">{items.length}</span>
                  {!col.key && items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPicked((prev) => (shown.every((x) => prev.has(x.r.id)) ? new Set([...prev].filter((id) => !shown.some((x) => x.r.id === id))) : new Set([...prev, ...shown.map((x) => x.r.id)])))}
                      className="ml-auto rounded-md px-2 py-1 text-[12px] font-bold text-[#4a4a48] hover:bg-white"
                    >
                      Select {shown.length}
                    </button>
                  )}
                </div>
                <p className="px-1 text-[12px] leading-snug font-medium text-[#4a4a48]">{col.tip}</p>
                {shown.map(({ r, eng, out }) => (
                  <div key={r.id} className="relative flex gap-3 rounded-xl border border-[#F0F0F1] bg-white p-3 shadow-[0_4px_14px_rgba(13,13,13,0.07)]">
                    <input type="checkbox" checked={picked.has(r.id)} onChange={() => togglePick(r.id)} className="mt-1 size-4 flex-none cursor-pointer accent-[#FF1F8F]" />
                    <a href={r.url} target="_blank" rel="noopener noreferrer" title="Open on Instagram" className="relative h-[84px] w-[63px] flex-none overflow-hidden rounded-md bg-[#2b2b29]">
                      {r.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
                      )}
                      {r.durationSeconds != null && <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">{fmtLen(r.durationSeconds)}</span>}
                    </a>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      {caption(r, "text-[13.5px] leading-[1.3] font-bold break-words")}
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-bold text-[#4a4a48] [font-variant-numeric:tabular-nums]">
                        <span className="flex items-center gap-1"><MaterialIcon name="event" size={12} /> {fmtDate(r.postedAt)}</span>
                        <span className="flex items-center gap-1" title="Views"><MaterialIcon name="visibility" size={12} /> {fmtN(r.views)}</span>
                        <span className="flex items-center gap-1" title="Likes"><MaterialIcon name="favorite" size={12} /> {r.likes < 0 ? "—" : fmtN(r.likes)}</span>
                        <span className="flex items-center gap-1" title="Comments"><MaterialIcon name="comment" size={12} /> {fmtN(r.comments)}</span>
                        <span className="flex items-center gap-1" title="Engagement rate"><MaterialIcon name="comment" size={12} /> {fmtPct(eng)}</span>
                        <OutlierBadge value={out} metric={goal} />
                      </span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#D4D4D2] py-8 text-center text-xs font-semibold text-[#9a9a98]">
                    <MaterialIcon name={col.icon} size={22} />
                    Nothing here
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rows.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="mx-auto flex h-10 items-center gap-1.5 rounded-lg border border-[#E4E4E2] bg-white px-5 text-[13.5px] font-bold hover:border-[#0D0D0D]">
          <MaterialIcon name="expand_more" size={18} /> Show {Math.min(PAGE, rows.length - limit)} more ({rows.length - limit} left)
        </button>
      )}
    </div>
  );
}
