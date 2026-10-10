"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelThumb } from "@/components/reel-thumb";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { BackLink } from "@/components/back-link";
import { useRememberedState } from "@/lib/use-remembered-state";
import { analyzeSingleReel } from "@/app/analyze-reel/actions";
import { MIN_REELS_FOR_OUTLIER, OUTLIER_GOALS, fmtOutlier, outlierOf, typicalByGoal, median, type OutlierGoal } from "@/lib/outlier";

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
const pct = (n: number | null, d: number) => (n == null || d <= 0 ? null : (n / d) * 100);
const fmtPct = (x: number | null) => (x == null ? "—" : x.toFixed(x >= 10 ? 1 : 2) + "%");
const fmtLen = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—");

type SortKey = "posted" | "views" | "likes" | "comments" | "length" | "engagement" | "shareRate" | "outlier";
const GRID = "grid-cols-[28px_minmax(260px,1fr)_96px_80px_80px_90px_70px_100px_100px_120px_110px]";

function Pick({ icon, label, value, onChange, options }: { icon: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase">{label}</span>
      <span className="relative">
        <MaterialIcon name={icon} size={17} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#4a4a48]" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full cursor-pointer appearance-none rounded-md border border-[#E4E4E2] bg-white pr-8 pl-9 text-[13px] font-semibold outline-none hover:border-[#BDBDBB] focus:border-[#0D0D0D]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[#4a4a48]" />
      </span>
    </label>
  );
}

export function CreatorClient({ username, avatar, reels }: { username: string; avatar: string | null; reels: CreatorReel[] }) {
  const router = useRouter();
  const key = (s: string) => `vh-creator-${username}-${s}`;
  const [goal, setGoal] = useRememberedState<OutlierGoal>(key("goal"), "views");
  const [sort, setSort] = useRememberedState<{ key: SortKey; dir: 1 | -1 }>(key("sort"), { key: "posted", dir: -1 });
  const [status, setStatus] = useRememberedState<string>(key("status"), "all");
  const [minEng, setMinEng] = useRememberedState<string>(key("eng"), "0");
  const [minShare, setMinShare] = useRememberedState<string>(key("share"), "0");
  const [minOutlier, setMinOutlier] = useRememberedState<string>(key("outlier"), "0");
  const [q, setQ] = useState("");
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

  function head(k: SortKey, label: string, icon?: string, tip?: string) {
    const on = sort.key === k;
    return (
      <button
        type="button"
        title={tip ?? label}
        onClick={() => setSort(on ? { key: k, dir: (sort.dir * -1) as 1 | -1 } : { key: k, dir: -1 })}
        className={`flex items-center justify-center gap-1 whitespace-nowrap hover:text-[#FF1F8F] ${on ? "text-[#0D0D0D]" : ""}`}
      >
        {icon && <MaterialIcon name={icon} size={15} />}
        {label}
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

  const tags = (x: boolean) =>
    x ? (
      <span className="flex w-fit items-center gap-1 rounded-[10px] bg-[#EAF8D8] px-2 py-0.5 text-[11.5px] font-bold text-[#3a8a00]">
        <MaterialIcon name="check_circle" size={13} /> Analyzed
      </span>
    ) : (
      <span className="flex w-fit items-center gap-1 rounded-[10px] bg-[#F0F0F1] px-2 py-0.5 text-[11.5px] font-bold text-[#4a4a48]">
        <MaterialIcon name="radar" size={13} /> Scanned
      </span>
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
        <div className="ml-auto grid grid-cols-2 gap-2 text-[12.5px] font-bold md:grid-cols-4">
          {[
            ["Reels scanned", String(reels.length)],
            ["Analyzed", String(analyzedCount)],
            ["Typical views", fmtN(median(reels.map((r) => r.views)) ?? 0)],
            ["Best reel", fmtN(best.views)],
          ].map(([l, v]) => (
            <span key={l} className="flex min-w-[96px] flex-col rounded-lg border border-[#F0F0F1] bg-white px-3 py-2 shadow-[0_4px_16px_rgba(13,13,13,0.06)]">
              <span className="text-[10.5px] font-extrabold tracking-wide text-[#6b6b69] uppercase">{l}</span>
              <span className="text-[18px] font-black">{v}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-[#F0F0F1] bg-white p-3.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 min-w-[220px] flex-1 items-center gap-2.5 rounded-md border border-[#E4E4E2] px-3 focus-within:border-[#0D0D0D]">
            <MaterialIcon name="search" size={19} className="text-[#4a4a48]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search captions…" autoComplete="off" className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium outline-none" />
          </div>
          <div className="flex h-10 overflow-hidden rounded-md border border-[#E4E4E2]" title="Which goal the outlier score is measured on">
            {OUTLIER_GOALS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGoal(g.key)}
                className="flex items-center gap-1.5 px-3.5 text-[13px] font-bold hover:text-[#FF1F8F]"
                style={{ background: goal === g.key ? "#F0F0F1" : undefined }}
              >
                <MaterialIcon name={g.icon} size={16} className={goal === g.key ? "text-[#FF1F8F]" : undefined} />
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Pick label="Status" icon="fact_check" value={status} onChange={setStatus} options={[{ value: "all", label: "All reels" }, { value: "scanned", label: "Scanned only" }, { value: "analyzed", label: "Analyzed" }]} />
          <Pick label="Engagement rate" icon="forum" value={minEng} onChange={setMinEng} options={[{ value: "0", label: "Any" }, { value: "0.05", label: "0.05%+" }, { value: "0.1", label: "0.1%+" }, { value: "0.25", label: "0.25%+" }, { value: "0.5", label: "0.5%+" }, { value: "1", label: "1%+" }]} />
          <Pick label="Share rate" icon="repeat" value={minShare} onChange={setMinShare} options={[{ value: "0", label: "Any" }, { value: "0.05", label: "0.05%+" }, { value: "0.1", label: "0.1%+" }, { value: "0.25", label: "0.25%+" }, { value: "0.5", label: "0.5%+" }]} />
          <Pick label={`${goalMeta.label} outlier`} icon="trending_up" value={minOutlier} onChange={setMinOutlier} options={[{ value: "0", label: "Any" }, { value: "1.5", label: "1.5x+" }, { value: "2", label: "2x+" }, { value: "3", label: "3x+" }, { value: "5", label: "5x+" }, { value: "10", label: "10x+" }]} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] font-semibold text-[#4a4a48]">
          <span>
            {rows.length} {rows.length === 1 ? "reel" : "reels"}
            {filtersOn ? " match" : ""}
            {!enough && ` · ${goalMeta.label} outlier needs at least ${MIN_REELS_FOR_OUTLIER} reels with ${goal === "shares" ? "share counts (analyze more)" : "numbers"}`}
          </span>
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
            className="flex items-center gap-1 rounded-md border border-[#E4E4E2] px-2.5 py-1 font-bold text-[#D10A6E] hover:border-[#D10A6E] disabled:text-[#9a9a98] disabled:hover:border-[#E4E4E2]"
          >
            <MaterialIcon name="filter_alt_off" size={15} /> Clear filters
          </button>
        </div>
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

      <div className="overflow-x-auto rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <div className="min-w-[1180px]">
          <div className={`grid ${GRID} items-center gap-4 border-b border-[#CFCFCD] px-4 py-3 text-xs font-bold text-[#4a4a48]`}>
            <input
              type="checkbox"
              aria-label="Select all shown"
              checked={rows.length > 0 && rows.every((x) => picked.has(x.r.id))}
              onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((x) => x.r.id)) : new Set())}
              className="size-4 cursor-pointer accent-[#FF1F8F]"
            />
            <span>Reel</span>
            {head("posted", "Posted")}
            {head("views", "Views", "visibility")}
            {head("likes", "Likes", "favorite")}
            {head("comments", "Comments", "chat_bubble")}
            {head("length", "Length", "schedule")}
            {head("engagement", "Engagement", "forum", "Engagement rate (comments ÷ views)")}
            {head("shareRate", "Share Rate", "repeat", "Share rate (reposts ÷ views)")}
            {head("outlier", `${goalMeta.label} Outlier`, "trending_up", `${goalMeta.label} outlier: how many times the creator's typical reel`)}
            <span>Status</span>
          </div>
          {rows.length === 0 && <div className="px-5 py-12 text-center text-sm font-medium text-[#4a4a48]">No reels match these filters.</div>}
          {rows.map(({ r, eng, share, out }) => (
            <div key={r.id} className={`grid ${GRID} items-center gap-4 border-b border-[#F0F0F1] px-4 py-2.5 text-[13px] font-semibold last:border-b-0 hover:bg-[#FBFBFA]`} style={{ background: picked.has(r.id) ? "#FBFBFA" : undefined }}>
              <input
                type="checkbox"
                checked={picked.has(r.id)}
                onChange={() =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(r.id)) next.delete(r.id);
                    else next.add(r.id);
                    return next;
                  })
                }
                className="size-4 cursor-pointer accent-[#FF1F8F]"
              />
              <div className="flex min-w-0 items-center gap-3">
                <a href={r.url} target="_blank" rel="noopener noreferrer" title="Open on Instagram" className="flex-none">
                  <ReelThumb url={r.thumbnailUrl} />
                </a>
                {r.analyzed ? (
                  <Link href={`/analyze-reel/reel/${r.id}`} className="line-clamp-2 min-w-0 text-[13.5px] leading-[1.3] font-bold hover:text-[#FF1F8F]">
                    {r.caption.split("\n")[0] || "(no caption)"}
                  </Link>
                ) : (
                  <span className="line-clamp-2 min-w-0 text-[13.5px] leading-[1.3] font-bold">{r.caption.split("\n")[0] || "(no caption)"}</span>
                )}
              </div>
              <span className="text-center text-[#4a4a48]">{fmtDate(r.postedAt)}</span>
              <span className="text-center">{fmtN(r.views)}</span>
              <span className="text-center">{r.likes < 0 ? "—" : fmtN(r.likes)}</span>
              <span className="text-center">{fmtN(r.comments)}</span>
              <span className="text-center">{fmtLen(r.durationSeconds)}</span>
              <span className="text-center">{fmtPct(eng)}</span>
              <span className="text-center">{fmtPct(share)}</span>
              <span className="flex justify-center">
                {out == null ? (
                  <span className="text-[#9a9a98]">—</span>
                ) : (
                  <span className="rounded-md px-2 py-0.5 text-[12.5px] font-extrabold" style={{ background: out >= 3 ? "#C6FF3D" : out >= 1.5 ? "#EAF8D8" : "#F0F0F1", color: "#0D0D0D" }}>
                    {fmtOutlier(out)}
                  </span>
                )}
              </span>
              {tags(r.analyzed)}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[12px] font-medium text-[#6b6b69]">
        Scanned reels show views, likes, comments, date and length. Analyze a reel to add shares, saves, reposts, the transcript and its hook.
      </p>
    </div>
  );
}
