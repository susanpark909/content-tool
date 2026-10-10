"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelThumb } from "@/components/reel-thumb";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { BackLink } from "@/components/back-link";
import { Dropdown } from "@/components/dropdown";
import { MetricHeader } from "@/components/metric-header";
import { OutlierBadge, OutlierFilter } from "@/components/outlier-filter";
import { ActionDialog } from "@/components/action-dialog";
import { SuggestDialog, TypeChips, TypeFilter, TypePicker, UNTAGGED, useTypes } from "@/components/types-ui";
import { useRememberedState } from "@/lib/use-remembered-state";
import { analyzeSingleReel } from "@/app/analyze-reel/actions";
import { setReelGoals, type ReelGoal } from "@/app/reels/actions";
import { addTypesToReels, setReelTypes } from "@/app/types/actions";
import { MIN_REELS_FOR_OUTLIER, OUTLIER_GOALS, outlierOf, typicalByGoal, type OutlierGoal } from "@/lib/outlier";
import { RATE_METRICS, fmtRate, rateOf, type RateKey } from "@/lib/rates";
import type { ContentType } from "@/lib/content-types";

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
  analyzedAt: string;
  goals: ReelGoal[];
  typeIds: string[];
};

const GOALS: { value: ReelGoal; label: string; icon: string }[] = [
  { value: "views", label: "Views", icon: "visibility" },
  { value: "shares", label: "Shares", icon: "send" },
  { value: "comments", label: "Comments", icon: "comment" },
  { value: "saves", label: "Saves", icon: "bookmark" },
];

const fmtN = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k" : String(Math.round(n)));
const avgOf = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const fmtLen = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" }) : "—");
const optN = (n: number | null) => (n == null ? "—" : fmtN(n));

type SortKey = "posted" | "analyzedAt" | "views" | "likes" | "comments" | "shares" | "reposts" | "saves" | "length" | "rate" | "outlier" | "analyzed" | "goal";
const GRID = "grid-cols-[28px_minmax(260px,1fr)_72px_72px_58px_repeat(6,minmax(56px,70px))_84px_84px_46px_66px]";
const PAGE = 200;

const TIP_ANALYZED = "Analyzed means it's been transcribed, with the hook and CTA pulled out and organized.";
const TIP_SCANNED = "Not analyzed yet: views, likes, comments, date and length only. Analyze it to get the transcript, hook and CTA.";

// The analyzed / not-yet icon, with a plain-English hover.
function StatusIcon({ analyzed }: { analyzed: boolean }) {
  return (
    <span className="group relative flex justify-self-center">
      <span
        className="flex size-7 items-center justify-center rounded-full"
        style={{ background: analyzed ? "#C6FF3D" : "#F0F0F1", color: analyzed ? "#0D0D0D" : "#9a9a98" }}
      >
        <MaterialIcon name={analyzed ? "check" : "radar"} size={analyzed ? 17 : 16} weight={500} />
      </span>
      <span className="pointer-events-none absolute right-0 bottom-full z-30 mb-1.5 w-[250px] rounded-lg bg-[#0D0D0D] px-3 py-2 text-left text-[12px] leading-snug font-semibold whitespace-normal text-white opacity-0 shadow-[0_8px_24px_rgba(13,13,13,0.25)] transition-opacity group-hover:opacity-100">
        {analyzed ? TIP_ANALYZED : TIP_SCANNED}
      </span>
    </span>
  );
}

// A reel's goals: tap to change.
function GoalCell({ goals, onChange }: { goals: ReelGoal[]; onChange: (g: ReelGoal[]) => void }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    if (pos) return setPos(null);
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 200), left: Math.max(8, Math.min(r.left - 60, window.innerWidth - 170)) });
  };
  return (
    <div className="justify-self-center">
      <button ref={btn} type="button" onClick={toggle} title="Goal" className="flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-full border border-dashed border-[#D4D4D2] px-1.5 hover:border-[#FF1F8F]" style={{ borderStyle: goals.length ? "solid" : "dashed", borderColor: goals.length ? "#FFC2E0" : undefined, background: goals.length ? "#FFF0F7" : undefined }}>
        {goals.length === 0 ? (
          <MaterialIcon name="target" size={15} className="text-[#BDBDBB]" />
        ) : (
          goals.slice(0, 3).map((g) => <MaterialIcon key={g} name={GOALS.find((o) => o.value === g)?.icon ?? "target"} size={15} className="text-[#FF1F8F]" />)
        )}
      </button>
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setPos(null)} />
            <div style={{ top: pos.top, left: pos.left }} className="fixed z-[101] flex w-[160px] flex-col rounded-lg border border-[#E4E4E2] bg-white py-1 shadow-[0_12px_32px_rgba(13,13,13,0.18)]">
              {GOALS.map((g) => {
                const on = goals.includes(g.value);
                return (
                  <button key={g.value} type="button" onClick={() => onChange(on ? goals.filter((x) => x !== g.value) : [...goals, g.value])} className="flex items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold hover:bg-[#F6F6F5]">
                    <span className="flex size-[18px] flex-none items-center justify-center rounded-[4px] border-[1.5px]" style={{ background: on ? "#0D0D0D" : "#fff", borderColor: on ? "#0D0D0D" : "#BDBDBB" }}>
                      {on && <MaterialIcon name="check" size={13} className="text-white" />}
                    </span>
                    <MaterialIcon name={g.icon} size={15} /> {g.label}
                  </button>
                );
              })}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

export function CreatorClient({ username, avatar, reels, types: initialTypes }: { username: string; avatar: string | null; reels: CreatorReel[]; types: ContentType[] }) {
  const router = useRouter();
  const key = (s: string) => `vh-creator-${username}-${s}`;
  const { types: typeList, setTypes: setTypeList } = useTypes(initialTypes);
  const [view, setView] = useRememberedState<"list" | "board">("vh-creator-view", "list");
  const [outMetric, setOutMetric] = useRememberedState<OutlierGoal>(key("goal"), "views");
  const [rateMetric, setRateMetric] = useRememberedState<RateKey>(key("rate"), "comments");
  const [sort, setSort] = useRememberedState<{ key: SortKey; dir: 1 | -1 }>(key("sort"), { key: "posted", dir: -1 });
  const [analyzedFilter, setAnalyzedFilter] = useRememberedState<string>(key("status"), "all");
  const [goalFilter, setGoalFilter] = useRememberedState<string>(key("goalf"), "all");
  const [postedRange, setPostedRange] = useRememberedState<string>(key("posted"), "all");
  const [minRate, setMinRate] = useRememberedState<string>(key("minrate"), "0");
  const [minOutlier, setMinOutlier] = useRememberedState<number>(key("minout"), 0);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [goalMap, setGoalMap] = useState<Record<string, ReelGoal[]>>({});
  const [typeMap, setTypeMap] = useState<Record<string, string[]>>({});
  const [tagOpen, setTagOpen] = useState(false);
  const [tagPick, setTagPick] = useState<Set<string>>(new Set());
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goalsOf = (r: CreatorReel) => goalMap[r.id] ?? r.goals;
  const typesOf = (r: CreatorReel) => typeMap[r.id] ?? r.typeIds;
  const rateMeta = RATE_METRICS.find((m) => m.key === rateMetric)!;
  const outMeta = OUTLIER_GOALS.find((g) => g.key === outMetric)!;

  const typical = useMemo(() => typicalByGoal(reels.map((r) => ({ views: r.views, comments: r.comments, shares: r.shares }))), [reels]);
  const enough = typical[outMetric] != null;

  const rows = useMemo(() => {
    const base = reels.map((r) => ({
      r,
      rate: rateOf({ views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, reposts: r.reposts, saves: r.saves }, rateMetric),
      out: outlierOf({ views: r.views, comments: r.comments, shares: r.shares }, outMetric, typical),
    }));
    const query = q.trim().toLowerCase();
    const cutoff = postedRange === "all" ? -Infinity : Date.now() - Number(postedRange) * 86400000;
    const filtered = base.filter((x) => {
      const goals = goalMap[x.r.id] ?? x.r.goals;
      const ids = typeMap[x.r.id] ?? x.r.typeIds;
      if (analyzedFilter !== "all" && (analyzedFilter === "yes") !== x.r.analyzed) return false;
      if (goalFilter !== "all" && (goalFilter === "none" ? goals.length > 0 : !goals.includes(goalFilter as ReelGoal))) return false;
      if (postedRange !== "all" && (!x.r.postedAt || new Date(x.r.postedAt).getTime() < cutoff)) return false;
      if (Number(minRate) > 0 && (x.rate ?? -1) * 100 < Number(minRate)) return false;
      if (minOutlier > 0 && (x.out ?? -1) < minOutlier) return false;
      if (typeFilter.length > 0 && !((typeFilter.includes(UNTAGGED) && ids.length === 0) || typeFilter.some((t) => t !== UNTAGGED && ids.includes(t)))) return false;
      return !query || x.r.caption.toLowerCase().includes(query);
    });
    const val = (x: (typeof base)[number]): number =>
      sort.key === "posted" ? (x.r.postedAt ? new Date(x.r.postedAt).getTime() : 0)
        : sort.key === "analyzedAt" ? (x.r.analyzed ? new Date(x.r.analyzedAt).getTime() : 0)
        : sort.key === "views" ? x.r.views
        : sort.key === "likes" ? x.r.likes
        : sort.key === "comments" ? x.r.comments
        : sort.key === "shares" ? (x.r.shares ?? -1)
        : sort.key === "reposts" ? (x.r.reposts ?? -1)
        : sort.key === "saves" ? (x.r.saves ?? -1)
        : sort.key === "length" ? (x.r.durationSeconds ?? -1)
        : sort.key === "rate" ? (x.rate ?? -1)
        : sort.key === "analyzed" ? Number(x.r.analyzed)
        : sort.key === "goal" ? (goalMap[x.r.id] ?? x.r.goals).length
        : (x.out ?? -1);
    return filtered.sort((a, b) => (val(a) - val(b)) * sort.dir);
  }, [reels, rateMetric, outMetric, typical, q, analyzedFilter, goalFilter, postedRange, minRate, minOutlier, typeFilter, sort, goalMap, typeMap]);

  const analyzedCount = reels.filter((r) => r.analyzed).length;
  const best = reels.reduce((m, r) => (r.views > m.views ? r : m), reels[0]);
  const filtersOn = q !== "" || analyzedFilter !== "all" || goalFilter !== "all" || postedRange !== "all" || minRate !== "0" || minOutlier > 0 || typeFilter.length > 0;
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
  function setGoals(id: string, g: ReelGoal[]) {
    setGoalMap((p) => ({ ...p, [id]: g }));
    setReelGoals(id, g).catch(() => {});
  }
  function setTypes(id: string, ids: string[]) {
    setTypeMap((p) => ({ ...p, [id]: ids }));
    setReelTypes(id, ids).catch(() => {});
  }
  function addTypes(ids: string[], typeIds: string[]) {
    setTypeMap((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = [...new Set([...(next[id] ?? reels.find((r) => r.id === id)?.typeIds ?? []), ...typeIds])];
      return next;
    });
    addTypesToReels(ids, typeIds).catch(() => {});
  }

  const arrowFor = (k: SortKey) => (sort.key === k ? (sort.dir === 1 ? "arrow_upward" : "arrow_downward") : "unfold_more");
  const sortBy = (k: SortKey) => setSort(sort.key === k ? { key: k, dir: (sort.dir * -1) as 1 | -1 } : { key: k, dir: -1 });
  function head(k: SortKey, label: string, icon?: string, tip?: string) {
    const on = sort.key === k;
    return (
      <button type="button" title={tip ?? label} aria-label={tip ?? label} onClick={() => sortBy(k)} className={`flex items-center justify-center justify-self-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F] ${on ? "text-[#0D0D0D]" : ""}`}>
        {icon ? <MaterialIcon name={icon} size={17} /> : label} <MaterialIcon name={arrowFor(k)} size={15} />
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

  const rateOptions = [{ value: "0", label: "Any" }, { value: "0.05", label: "0.05%+" }, { value: "0.1", label: "0.1%+" }, { value: "0.25", label: "0.25%+" }, { value: "0.5", label: "0.5%+" }, { value: "1", label: "1%+" }, { value: "2", label: "2%+" }];

  const caption = (r: CreatorReel, cls: string) =>
    r.analyzed ? (
      <Link href={`/analyze-reel/reel/${r.id}`} className={`${cls} hover:text-[#FF1F8F]`}>
        {r.caption.split("\n")[0] || "(no caption)"}
      </Link>
    ) : (
      <span className={cls}>{r.caption.split("\n")[0] || "(no caption)"}</span>
    );

  const typeCell = (r: CreatorReel) => {
    const ids = typesOf(r);
    return (
      <TypePicker types={typeList} value={ids} onChange={(v) => setTypes(r.id, v)} onTypesChange={setTypeList} className="flex flex-none items-center rounded-md px-0.5 hover:bg-[#F0F0F1]">
        {ids.length > 0 ? (
          <TypeChips types={typeList} ids={ids} max={2} />
        ) : (
          <span className="flex items-center gap-0.5 text-[11px] font-bold text-[#9a9a98] hover:text-[#FF1F8F]">
            <MaterialIcon name="sell" size={12} /> Tag
          </span>
        )}
      </TypePicker>
    );
  };

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

      <div className="flex flex-col gap-2.5 rounded-lg border border-[#F0F0F1] bg-white p-3 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <div className="flex h-10 items-center gap-2.5 rounded-md border border-[#E4E4E2] px-3 focus-within:border-[#0D0D0D]">
          <MaterialIcon name="search" size={19} className="text-[#4a4a48]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search captions…" autoComplete="off" className="min-w-0 flex-1 border-0 bg-transparent text-[14px] font-medium outline-none" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown prefix="Analyzed" value={analyzedFilter} onChange={setAnalyzedFilter} options={[{ value: "all", label: "All" }, { value: "yes", label: "Yes" }, { value: "no", label: "Not yet" }]} className="w-[150px]" />
          <Dropdown prefix="Goal" value={goalFilter} onChange={setGoalFilter} options={[{ value: "all", label: "All" }, { value: "views", label: "Views" }, { value: "shares", label: "Shares" }, { value: "comments", label: "Comments" }, { value: "saves", label: "Saves" }, { value: "none", label: "None set" }]} className="w-[130px]" />
          <Dropdown prefix="Posted" value={postedRange} onChange={setPostedRange} options={[{ value: "all", label: "Any date" }, { value: "7", label: "Last 7 days" }, { value: "14", label: "Last 14 days" }, { value: "30", label: "Last 30 days" }, { value: "60", label: "Last 60 days" }, { value: "90", label: "Last 90 days" }]} className="w-[200px]" />
          <TypeFilter types={typeList} onTypesChange={setTypeList} value={typeFilter} onChange={setTypeFilter} className="w-[170px]" />
          <OutlierFilter metric={outMetric} min={minOutlier} onChange={(m, n) => { setOutMetric(m); setMinOutlier(n); }} />
          <Dropdown prefix={`${rateMeta.label} %`} value={minRate} onChange={setMinRate} options={rateOptions} className="w-[170px]" />
          <button
            type="button"
            disabled={!filtersOn}
            onClick={() => {
              setQ("");
              setAnalyzedFilter("all");
              setGoalFilter("all");
              setPostedRange("all");
              setMinRate("0");
              setMinOutlier(0);
              setTypeFilter([]);
            }}
            className="flex h-9 items-center gap-1 rounded-md border border-[#E4E4E2] px-2.5 text-[12px] font-bold text-[#D10A6E] hover:border-[#D10A6E] disabled:text-[#9a9a98] disabled:hover:border-[#E4E4E2]"
          >
            <MaterialIcon name="filter_alt_off" size={15} /> Clear
          </button>
          <div className="flex h-9 overflow-hidden rounded-md border border-[#E4E4E2] bg-white md:ml-auto">
            {(["list", "board"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} title={v === "list" ? "List view" : "Board view: analyzed vs not yet"} aria-label={v === "list" ? "List view" : "Board view"} className="flex w-10 items-center justify-center hover:text-[#FF1F8F]" style={{ background: view === v ? "#F0F0F1" : undefined }}>
                <MaterialIcon name={v === "list" ? "view_list" : "grid_view"} size={19} />
              </button>
            ))}
          </div>
        </div>
        <span className="text-[12px] font-semibold text-[#4a4a48]">
          {rows.length} {rows.length === 1 ? "reel" : "reels"}
          {filtersOn ? " match" : ""}
          {!enough && ` · ${outMeta.label} outlier needs at least ${MIN_REELS_FOR_OUTLIER} reels with ${outMetric === "shares" ? "share counts (analyze more)" : "numbers"}`}
        </span>
      </div>

      {picked.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-lg bg-[#0D0D0D] px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_12px_32px_rgba(13,13,13,0.25)]">
          <span>{picked.size} selected</span>
          <button type="button" onClick={() => setPicked(new Set())} className="text-[12.5px] text-[#BDBDBB] hover:text-white">
            Clear
          </button>
          <button type="button" title="Tag content type" onClick={() => { setTagPick(new Set()); setTagOpen(true); }} className="flex h-8 items-center gap-1 rounded-md px-2.5 text-[12.5px] text-white hover:bg-white/10">
            <MaterialIcon name="sell" size={17} /> Tag
          </button>
          <button type="button" title="Auto-suggest tags" onClick={() => setSuggestOpen(true)} className="flex h-8 items-center gap-1 rounded-md px-2.5 text-[12.5px] text-white hover:bg-white/10">
            <MaterialIcon name="auto_awesome" size={17} /> Suggest
          </button>
          <button type="button" disabled={busy || toAnalyze.length === 0} onClick={analyzePicked} className="ml-auto flex h-9 items-center gap-1.5 rounded-md bg-[#FF1F8F] px-4 text-[13px] font-extrabold text-[#0D0D0D] hover:bg-white disabled:opacity-60">
            {busy ? <EqualizerIcon size={15} /> : <MaterialIcon name="bolt" size={17} weight={500} />}
            {busy ? "Analyzing…" : toAnalyze.length === 0 ? "Already analyzed" : `Analyze (${toAnalyze.length})`}
          </button>
        </div>
      )}
      {error && <p className="text-[13px] font-semibold text-[#D10A6E]">{error}</p>}

      {view === "list" ? (
        <div className="overflow-x-auto rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          <div className="min-w-[1380px]">
            <div className={`grid ${GRID} items-center gap-3 border-b border-[#CFCFCD] px-4 py-3 text-xs font-bold text-[#4a4a48]`}>
              <input type="checkbox" aria-label="Select all shown" checked={shownRows.length > 0 && shownRows.every((x) => picked.has(x.r.id))} onChange={(e) => setPicked(e.target.checked ? new Set(shownRows.map((x) => x.r.id)) : new Set())} className="size-4 cursor-pointer accent-[#FF1F8F]" />
              <span>Post</span>
              {head("posted", "Posted")}
              {head("analyzedAt", "Analyzed")}
              {head("length", "Length", "av_timer", "Length")}
              {head("views", "Views", "visibility", "Views")}
              {head("likes", "Likes", "favorite", "Likes")}
              {head("comments", "Comments", "comment", "Comments")}
              {head("shares", "Shares", "send", "Shares (appear once analyzed)")}
              {head("reposts", "Reposts", "repeat", "Reposts (appear once analyzed)")}
              {head("saves", "Saves", "bookmark", "Saves (appear once analyzed)")}
              <MetricHeader title="Rate" suffix="%" value={rateMetric} onChange={(v) => setRateMetric(v as RateKey)} options={RATE_METRICS.map((m) => ({ value: m.key, label: m.label, icon: m.icon, tip: m.tip }))} arrow={arrowFor("rate")} onSort={() => sortBy("rate")} active={sort.key === "rate"} />
              <MetricHeader title="Outlier" value={outMetric} onChange={(v) => setOutMetric(v as OutlierGoal)} options={OUTLIER_GOALS.map((g) => ({ value: g.key, label: g.label, icon: "rocket_launch", tip: `${g.label} outlier score` }))} arrow={arrowFor("outlier")} onSort={() => sortBy("outlier")} active={sort.key === "outlier"} />
              {head("analyzed", "Analyzed", "check_circle", "Analyzed")}
              {head("goal", "Goal", "target", "Goal")}
            </div>
            {rows.length === 0 && <div className="px-5 py-12 text-center text-sm font-medium text-[#4a4a48]">No reels match these filters.</div>}
            {shownRows.map(({ r, rate, out }) => (
              <div key={r.id} className={`grid ${GRID} items-center gap-3 border-b border-[#F0F0F1] px-4 py-2.5 text-[13px] font-semibold last:border-b-0 hover:bg-[#FBFBFA]`} style={{ background: picked.has(r.id) ? "#FBFBFA" : undefined }}>
                <input type="checkbox" checked={picked.has(r.id)} onChange={() => togglePick(r.id)} className="size-4 cursor-pointer accent-[#FF1F8F]" />
                <div className="flex min-w-0 items-center gap-3">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" title="Open on Instagram" className="flex-none">
                    <ReelThumb url={r.thumbnailUrl} />
                  </a>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {caption(r, "line-clamp-2 min-w-0 text-[13.5px] leading-[1.3] font-bold")}
                    {typeCell(r)}
                  </div>
                </div>
                <span className="text-center whitespace-nowrap text-[#4a4a48]">{fmtDate(r.postedAt)}</span>
                <span className="text-center whitespace-nowrap text-[#4a4a48]">{r.analyzed ? fmtDate(r.analyzedAt) : "—"}</span>
                <span className="text-center">{fmtLen(r.durationSeconds)}</span>
                <span className="text-center">{fmtN(r.views)}</span>
                <span className="text-center">{r.likes < 0 ? "—" : fmtN(r.likes)}</span>
                <span className="text-center">{fmtN(r.comments)}</span>
                <span className="text-center" style={{ color: r.shares == null ? "#9a9a98" : undefined }}>{optN(r.shares)}</span>
                <span className="text-center" style={{ color: r.reposts == null ? "#9a9a98" : undefined }}>{optN(r.reposts)}</span>
                <span className="text-center" style={{ color: r.saves == null ? "#9a9a98" : undefined }}>{optN(r.saves)}</span>
                <span className="text-center" title={rateMeta.tip} style={{ color: rate == null ? "#9a9a98" : undefined }}>{fmtRate(rate)}</span>
                <span className="flex justify-center">{out == null ? <span className="text-[#9a9a98]">—</span> : <OutlierBadge value={out} metric={outMetric} />}</span>
                <StatusIcon analyzed={r.analyzed} />
                <GoalCell goals={goalsOf(r)} onChange={(g) => setGoals(r.id, g)} />
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
                    <button type="button" onClick={() => setPicked((prev) => (shown.every((x) => prev.has(x.r.id)) ? new Set([...prev].filter((id) => !shown.some((x) => x.r.id === id))) : new Set([...prev, ...shown.map((x) => x.r.id)])))} className="ml-auto rounded-md px-2 py-1 text-[12px] font-bold text-[#4a4a48] hover:bg-white">
                      Select {shown.length}
                    </button>
                  )}
                </div>
                <p className="px-1 text-[12px] leading-snug font-medium text-[#4a4a48]">{col.tip}</p>
                {shown.map(({ r, rate, out }) => (
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
                        <span className="flex items-center gap-1" title={rateMeta.tip}><MaterialIcon name={rateMeta.icon} size={12} /> {fmtRate(rate)}</span>
                        <OutlierBadge value={out} metric={outMetric} />
                      </span>
                      {typeCell(r)}
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

      {tagOpen && (
        <ActionDialog
          title={`Tag ${picked.size} ${picked.size === 1 ? "reel" : "reels"}`}
          onClose={() => setTagOpen(false)}
          confirmLabel="Add tags"
          confirmDisabled={tagPick.size === 0}
          onConfirm={() => {
            addTypes([...picked], [...tagPick]);
            setTagOpen(false);
            setPicked(new Set());
          }}
        >
          {typeList.map((t) => {
            const on = tagPick.has(t.id);
            return (
              <button key={t.id} type="button" onClick={() => setTagPick((prev) => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next; })} className="flex items-center gap-3 px-6 py-2.5 text-left hover:bg-[#F6F6F5]">
                <span className="flex size-[18px] flex-none items-center justify-center rounded-[4px] border-[1.5px]" style={{ background: on ? "#0D0D0D" : "#fff", borderColor: on ? "#0D0D0D" : "#BDBDBB" }}>
                  {on && <MaterialIcon name="check" size={13} className="text-white" />}
                </span>
                <TypeChips types={typeList} ids={[t.id]} max={1} small={false} />
              </button>
            );
          })}
        </ActionDialog>
      )}
      {suggestOpen && (
        <SuggestDialog
          reels={reels.filter((r) => picked.has(r.id)).map((r) => ({ id: r.id, caption: r.caption, thumbnailUrl: r.thumbnailUrl }))}
          types={typeList}
          onTypesChange={setTypeList}
          onClose={() => setSuggestOpen(false)}
          onApply={(picks) => {
            const byType = new Map<string, string[]>();
            for (const [rid, tids] of Object.entries(picks)) for (const tid of tids) byType.set(tid, [...(byType.get(tid) ?? []), rid]);
            for (const [tid, rids] of byType) addTypes(rids, [tid]);
            setSuggestOpen(false);
            setPicked(new Set());
          }}
        />
      )}
    </div>
  );
}
