"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelThumb } from "@/components/reel-thumb";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { BackLink } from "@/components/back-link";
import { Dropdown } from "@/components/dropdown";
import { FavoriteCreator } from "../favorite-creator";
import { DeleteCreator } from "../delete-creator";
import { FilterPanel } from "@/components/filter-panel";
import { MetricHeader } from "@/components/metric-header";
import { SortControl } from "@/components/sort-control";
import { OutlierBadge } from "@/components/outlier-filter";
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
  postType: string;
  analyzedAt: string;
  analyzing: boolean;
  favorite: boolean;
  boardNames: string[];
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
const TIP_SCANNED = "Not analyzed yet. Click Analyze for the transcript.";

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

export function CreatorClient({ username, avatar, reels, types: initialTypes, favorite }: { username: string; avatar: string | null; reels: CreatorReel[]; types: ContentType[]; favorite: boolean }) {
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
  const [formatFilter, setFormatFilter] = useState("all");
  const [favFilter, setFavFilter] = useState("all");
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
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const goalsOf = (r: CreatorReel) => goalMap[r.id] ?? r.goals;
  const typesOf = (r: CreatorReel) => typeMap[r.id] ?? r.typeIds;
  const rateMeta = RATE_METRICS.find((m) => m.key === rateMetric)!;
  const outMeta = OUTLIER_GOALS.find((g) => g.key === outMetric)!;

  const typical = useMemo(() => typicalByGoal(reels.filter((r) => r.postType === "reel").map((r) => ({ views: r.views, comments: r.comments, shares: r.shares }))), [reels]);
  const enough = typical[outMetric] != null;

  const rows = useMemo(() => {
    const base = reels.map((r) => ({
      r,
      rate: rateOf({ views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, reposts: r.reposts, saves: r.saves }, rateMetric),
      out: r.postType === "reel" ? outlierOf({ views: r.views, comments: r.comments, shares: r.shares }, outMetric, typical) : null,
    }));
    const query = q.trim().toLowerCase();
    const cutoff = postedRange === "all" ? -Infinity : Date.now() - Number(postedRange) * 86400000;
    const filtered = base.filter((x) => {
      const goals = goalMap[x.r.id] ?? x.r.goals;
      const ids = typeMap[x.r.id] ?? x.r.typeIds;
      if (formatFilter !== "all" && (formatFilter === "reel") !== (x.r.postType === "reel")) return false;
      if (favFilter === "posts" && !x.r.favorite) return false;
      if (analyzedFilter !== "all" && (analyzedFilter === "yes") !== x.r.analyzed) return false;
      if (goalFilter !== "all" && (goalFilter === "none" ? goals.length > 0 : !goals.includes(goalFilter as ReelGoal))) return false;
      if (postedRange !== "all" && (!x.r.postedAt || new Date(x.r.postedAt).getTime() < cutoff)) return false;
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
  }, [reels, rateMetric, outMetric, typical, q, analyzedFilter, goalFilter, postedRange, typeFilter, formatFilter, favFilter, sort, goalMap, typeMap]);

  const analyzedCount = reels.filter((r) => r.analyzed).length;
  // anything being analyzed (from any page) keeps refreshing until it's done
  const anyAnalyzing = reels.some((r) => r.analyzing);
  useEffect(() => {
    if (!anyAnalyzing) return;
    const t = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(t);
  }, [anyAnalyzing, router]);
  const best = reels.reduce((m, r) => (r.views > m.views ? r : m), reels[0]);
  const filtersOn = q !== "" || analyzedFilter !== "all" || goalFilter !== "all" || postedRange !== "all" || typeFilter.length > 0 || formatFilter !== "all" || favFilter !== "all";
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
    const ids = toAnalyze.map((r) => r.id);
    setBusy(true);
    setError(null);
    setAnalyzingIds((prev) => new Set([...prev, ...ids]));
    setPicked(new Set());
    try {
      const fd = new FormData();
      fd.set("reelUrl", toAnalyze.map((r) => r.url).join("\n"));
      await analyzeSingleReel(fd);
      router.refresh();
    } catch (e) {
      setError(e instanceof TypeError ? "Lost the connection. It may have finished, so refresh to check." : e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
      setAnalyzingIds((prev) => new Set([...prev].filter((x) => !ids.includes(x))));
    }
  }

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
            <FavoriteCreator username={username} initial={favorite} size={30} className="ml-2 inline-flex size-11 align-middle" />
            <DeleteCreator username={username} posts={reels.length} />
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
          ].map(([l, v]) => (
            <span key={l} title={l === "Analyzed" ? TIP_ANALYZED : undefined} className="flex min-w-[88px] flex-col rounded-lg border border-[#F0F0F1] bg-white px-3 py-2 shadow-[0_4px_16px_rgba(13,13,13,0.06)]">
              <span className="text-[10.5px] font-extrabold tracking-wide text-[#6b6b69] uppercase">{l}</span>
              <span className="text-[18px] font-black">{v}</span>
            </span>
          ))}
          {/* the most-viewed reel: its view count, and a link to its page */}
          <Link
            href={`/analyze-reel/reel/${best.id}`}
            title="Open the most viewed reel"
            className="group flex min-w-[88px] flex-col rounded-lg border border-[#F0F0F1] bg-white px-3 py-2 shadow-[0_4px_16px_rgba(13,13,13,0.06)] hover:border-[#FF1F8F]"
          >
            <span className="flex items-center gap-1 text-[10.5px] font-extrabold tracking-wide text-[#6b6b69] uppercase">
              Most viewed <MaterialIcon name="arrow_outward" size={12} className="group-hover:text-[#FF1F8F]" />
            </span>
            <span className="text-[18px] font-black">{fmtN(best.views)}</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 rounded-lg border border-[#F0F0F1] bg-white p-3 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-md border border-[#E4E4E2] px-3 focus-within:border-[#0D0D0D] md:max-w-[460px]">
            <MaterialIcon name="search" size={19} className="text-[#4a4a48]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search captions…" autoComplete="off" className="min-w-0 flex-1 border-0 bg-transparent text-[14px] font-medium outline-none" />
          </div>
          <FilterPanel count={[analyzedFilter !== "all", goalFilter !== "all", postedRange !== "all", formatFilter !== "all", favFilter !== "all", typeFilter.length > 0].filter(Boolean).length} onClear={() => {
              setQ("");
              setAnalyzedFilter("all");
              setGoalFilter("all");
              setPostedRange("all");
              setTypeFilter([]);
              setFormatFilter("all");
              setFavFilter("all");
            }}>
            <div className="grid grid-cols-2 gap-2.5">
                <Dropdown prefix="Analyzed" value={analyzedFilter} onChange={setAnalyzedFilter} options={[{ value: "all", label: "All" }, { value: "yes", label: "Yes" }, { value: "no", label: "Not yet" }]} className="w-full" />
                <Dropdown prefix="Goal" value={goalFilter} onChange={setGoalFilter} options={[{ value: "all", label: "All" }, { value: "views", label: "Views" }, { value: "shares", label: "Shares" }, { value: "comments", label: "Comments" }, { value: "saves", label: "Saves" }, { value: "none", label: "None set" }]} className="w-full" />
                <Dropdown prefix="Posted" value={postedRange} onChange={setPostedRange} options={[{ value: "all", label: "Any date" }, { value: "7", label: "Last 7 days" }, { value: "14", label: "Last 14 days" }, { value: "30", label: "Last 30 days" }, { value: "60", label: "Last 60 days" }, { value: "90", label: "Last 90 days" }]} className="w-full" />
                <Dropdown prefix="Format" value={formatFilter} onChange={setFormatFilter} options={[{ value: "all", label: "All" }, { value: "reel", label: "Reels" }, { value: "carousel", label: "Carousels" }]} className="w-full" />
                <Dropdown prefix="Favorites" value={favFilter} onChange={setFavFilter} options={[{ value: "all", label: "All" }, { value: "posts", label: "Favorite posts", short: "Posts" }]} className="w-full" />
                <TypeFilter types={typeList} onTypesChange={setTypeList} value={typeFilter} onChange={setTypeFilter} className="w-full" />
            </div>
          </FilterPanel>
        {view === "board" && (
          <SortControl
            options={[
              { value: "posted", label: "Date posted" },
              { value: "views", label: "Views" },
              { value: "likes", label: "Likes" },
              { value: "comments", label: "Comments" },
              { value: "shares", label: "Shares" },
              { value: "reposts", label: "Reposts" },
              { value: "saves", label: "Saves" },
              { value: "length", label: "Length" },
              { value: "rate:comments", label: "Engagement rate %" },
              { value: "rate:shares", label: "Share rate %" },
              ...OUTLIER_GOALS.map((g) => ({ value: `outlier:${g.key}`, label: `${g.label} outlier` })),
              { value: "analyzedAt", label: "Date analyzed" },
            ]}
            value={sort.key === "rate" ? `rate:${rateMetric}` : sort.key === "outlier" ? `outlier:${outMetric}` : sort.key}
            onChange={(v) => {
              if (v.startsWith("rate:")) {
                setRateMetric(v.slice(5) as RateKey);
                setSort({ key: "rate", dir: -1 });
              } else if (v.startsWith("outlier:")) {
                setOutMetric(v.slice(8) as OutlierGoal);
                setSort({ key: "outlier", dir: -1 });
              } else setSort({ key: v as SortKey, dir: -1 });
            }}
            asc={sort.dir === 1}
            onToggleAsc={() => setSort({ ...sort, dir: (sort.dir * -1) as 1 | -1 })}
            dateKeys={["posted", "analyzedAt"]}
          />
        )}
        <div className="flex h-9 overflow-hidden rounded-md border border-[#E4E4E2] bg-white">
          {(["list", "board"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} title={v === "list" ? "List view" : "Grid view, like Instagram"} aria-label={v === "list" ? "List view" : "Grid view"} className="flex w-10 items-center justify-center hover:text-[#FF1F8F]" style={{ background: view === v ? "#F0F0F1" : undefined }}>
              <MaterialIcon name={v === "list" ? "view_list" : "grid_view"} size={19} />
            </button>
          ))}
        </div>
        </div>
      </div>

      {picked.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-[#E4E4E2] bg-white px-4 py-2.5 text-[13.5px] font-bold text-[#0D0D0D] shadow-[0_8px_24px_rgba(13,13,13,0.12)]">
          <span>{picked.size} selected</span>
          <button type="button" onClick={() => setPicked(new Set())} className="text-[12.5px] text-[#6b6b69] hover:text-[#0D0D0D]">
            Clear
          </button>
          <button type="button" title="Tag content type" onClick={() => { setTagPick(new Set()); setTagOpen(true); }} className="flex h-8 items-center gap-1 rounded-md px-2.5 text-[12.5px] text-[#0D0D0D] hover:bg-[#F0F0F1]">
            <MaterialIcon name="sell" size={17} /> Tag
          </button>
          <button type="button" title="Auto-suggest tags" onClick={() => setSuggestOpen(true)} className="flex h-8 items-center gap-1 rounded-md px-2.5 text-[12.5px] text-[#0D0D0D] hover:bg-[#F0F0F1]">
            <MaterialIcon name="auto_awesome" size={17} /> Suggest
          </button>
          <button type="button" disabled={busy || toAnalyze.length === 0} onClick={analyzePicked} className="ml-auto flex h-9 items-center gap-1.5 rounded-md bg-[#FF1F8F] px-4 text-[13px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60">
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
                  <a href={r.url} target="_blank" rel="noopener noreferrer" title={r.postType === "reel" ? "Reel. Open on Instagram" : "Carousel. Open on Instagram"} className="relative flex-none">
                    <ReelThumb url={r.thumbnailUrl} />
                    {r.postType !== "reel" && (
                      <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-[#2F6BFF] text-white">
                        <MaterialIcon name="collections" size={10} />
                      </span>
                    )}
                  </a>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {caption(r, "line-clamp-2 min-w-0 text-[13.5px] leading-[1.3] font-bold")}
                    <div className="flex items-center gap-2">
                      {typeCell(r)}
                      {r.boardNames.length > 0 && (
                        <span title={`In: ${r.boardNames.join(", ")}`} className="flex flex-none items-center text-[#4a4a48]">
                          <MaterialIcon name="folder" size={15} />
                        </span>
                      )}
                    </div>
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
                {analyzingIds.has(r.id) || r.analyzing ? <span className="flex size-7 items-center justify-center rounded-full bg-[#FFF0F7] text-[#FF1F8F]" title="Analyzing…"><EqualizerIcon size={15} /></span> : <StatusIcon analyzed={r.analyzed} />}
                <GoalCell goals={goalsOf(r)} onChange={(g) => setGoals(r.id, g)} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Looks like their Instagram grid: a tile per post, with its numbers underneath.
        <div className="grid grid-cols-2 gap-3 md:gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {rows.length === 0 && <div className="col-span-full rounded-lg border border-[#F0F0F1] bg-white px-5 py-12 text-center text-sm font-medium text-[#4a4a48]">No reels match these filters.</div>}
          {shownRows.map(({ r, rate, out }) => {
            const shareRate = rateOf(r, "shares");
            const on = picked.has(r.id);
            const open = r.analyzed ? `/analyze-reel/reel/${r.id}` : r.url;
            const caption1 = r.caption.split("\n")[0] || "(no caption)";
            const stat = "flex items-center gap-1";
            return (
              <div key={r.id} className="flex flex-col overflow-hidden rounded-xl border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.08)] transition-shadow hover:shadow-[0_10px_28px_rgba(13,13,13,0.15)]">
                <div className="group relative aspect-[3/4] overflow-hidden bg-[#2b2b29]" title={caption1} style={{ boxShadow: on ? "inset 0 0 0 3px #FF1F8F" : undefined }}>
                  {r.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                  )}
                  {r.analyzed ? (
                    <Link href={open} className="absolute inset-0" aria-label={caption1} />
                  ) : (
                    <a href={open} target="_blank" rel="noopener noreferrer" className="absolute inset-0" aria-label="Open on Instagram" />
                  )}
                  {(analyzingIds.has(r.id) || r.analyzing) && (
                    <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 text-[12.5px] font-extrabold text-[#FF1F8F]">
                      <EqualizerIcon size={26} /> Analyzing…
                    </span>
                  )}
                  <span className="pointer-events-none absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/45 text-white" title={r.postType === "reel" ? "Reel" : "Carousel"}>
                    <MaterialIcon name={r.postType === "reel" ? "smart_display" : "collections"} size={14} />
                  </span>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-8 pb-2 text-[12px] font-bold text-white [font-variant-numeric:tabular-nums]">
                    <span className={stat} title="Views"><MaterialIcon name="visibility" size={14} /> {r.postType === "reel" ? fmtN(r.views) : "—"}</span>
                    <span className={stat} title="Likes"><MaterialIcon name="favorite" size={14} /> {r.likes < 0 ? "—" : fmtN(r.likes)}</span>
                    <span className={stat} title="Comments"><MaterialIcon name="comment" size={14} /> {fmtN(r.comments)}</span>
                    <span className={stat} title="Shares"><MaterialIcon name="send" size={14} /> {optN(r.shares)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePick(r.id)}
                    aria-label={on ? "Deselect" : "Select"}
                    className={`absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full border-2 border-white ${on ? "bg-[#FF1F8F]" : "bg-black/30 opacity-0 group-hover:opacity-100"} ${picked.size > 0 ? "opacity-100" : ""}`}
                  >
                    {on && <MaterialIcon name="check" size={14} className="text-white" />}
                  </button>
                </div>
                <div className="flex flex-col gap-2.5 px-3 pt-3 pb-3 text-[12px] font-bold text-[#0D0D0D] [font-variant-numeric:tabular-nums]">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="flex flex-col rounded-lg bg-[#F6F6F5] px-2.5 py-1.5"><span className="text-[10.5px] font-semibold text-[#6b6b69]">Engagement</span>{fmtRate(rate)}</span>
                    <span className="flex flex-col rounded-lg bg-[#F6F6F5] px-2.5 py-1.5"><span className="text-[10.5px] font-semibold text-[#6b6b69]">Share rate</span>{fmtRate(shareRate)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11.5px] font-semibold text-[#6b6b69]">
                    <span className="flex items-center gap-1" title="Length">
                      <MaterialIcon name="schedule" size={14} /> {r.durationSeconds != null ? fmtLen(r.durationSeconds) : "—"}
                    </span>
                    <span className="flex items-center gap-1" title="Date posted">
                      <MaterialIcon name="event" size={14} /> {fmtDate(r.postedAt)}
                    </span>
                    {out != null ? <OutlierBadge value={out} metric={outMetric} /> : <span>—</span>}
                    {r.analyzed && <MaterialIcon name="check_circle" size={16} className="text-[#2E9E3E]" />}
                  </div>
                </div>
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
