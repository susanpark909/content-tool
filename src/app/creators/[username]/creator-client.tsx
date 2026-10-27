"use client";

import { matchesSearch } from "@/lib/search-match";
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
import { ActionDialog, DialogOption, IconAction, NameDialog, NewBoardOption } from "@/components/action-dialog";
import { DownloadMenu } from "@/components/download-menu";
import { ViewToggle } from "@/components/view-toggle";
import { SuggestDialog, SuggestWithAiButton, TypeCell, TypeChips, TypeFilter, TypeInfo, UNTAGGED, useTypes } from "@/components/types-ui";
import { useRememberedState } from "@/lib/use-remembered-state";
import { AddToBoardIcon, GoalIcon } from "@/components/bar-icons";
import { PostGridCard } from "@/components/post-grid-card";
import { OUTLIER_STAGES, OUTLIER_STAGE_OPTIONS, RATE_STAGES, RATE_STAGE_OPTIONS, VIEW_STAGES, VIEW_STAGE_OPTIONS, parseCount, parsePercent, parseTimes, stageBounds, type StageKey } from "@/lib/filter-stages";
import { TS_META, tsMetaFor } from "@/lib/transcript-status";
import { startAnalysis } from "@/app/analyze-reel/actions";
import { deleteReels, getExportTexts, repullReels, setReelGoals, setReelGoalsBulk, type ReelGoal } from "@/app/reels/actions";
import { addReelsToBoard, createBoard, setFavorite } from "@/app/reels/boards-actions";
import { addTypesToReels, setReelTypes } from "@/app/types/actions";
import { MIN_REELS_FOR_OUTLIER, OUTLIER_COLUMN_TIP, OUTLIER_GOALS, fmtOutlier, outlierNeedsTip, outlierOf, typicalByGoal, typicalComments, type OutlierGoal } from "@/lib/outlier";
import { RATE_METRICS, fmtRate, rateOf, type RateKey } from "@/lib/rates";
import type { ContentType } from "@/lib/content-types";
import { fmtLen, fmtN, fmtShortDate as fmtDate } from "@/lib/format";

export type CreatorReel = {
  id: string;
  url: string;
  caption: string;
  preview: string;
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
  transcriptionStatus: string | null;
  noAudio: boolean;
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
  { value: "comments", label: "Comments", icon: "comment" },
  { value: "shares", label: "Shares", icon: "send" },
];

const avgOf = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const optN = (n: number | null) => (n == null ? "—" : fmtN(n));

type SortKey = "posted" | "analyzedAt" | "views" | "likes" | "comments" | "shares" | "reposts" | "saves" | "length" | "rate" | "outlier" | "analyzed" | "goal";
// the same columns as the Library list, so every list looks alike
// the same column widths and gaps as the Posts list in the Library, so both look identical
const GRID = "grid-cols-[22px_20px_34px_minmax(360px,1fr)_72px_72px_48px_54px_54px_54px_54px_60px_46px_36px_36px]";

const TIP_ANALYZED = "Analyzed means the transcript, hook and CTA have been pulled.";

// The analysis status icon: the same icons and messages as the Library.
function StatusIcon({ reel, working }: { reel: { transcriptionStatus: string | null; noAudio: boolean }; working: boolean }) {
  const ts = working ? TS_META.processing : tsMetaFor(reel);
  return (
    <span title={ts.label} className="flex size-7 items-center justify-center justify-self-center rounded-full" style={{ background: ts.bg, color: ts.fg }}>
      {working || reel.transcriptionStatus === "processing" ? <EqualizerIcon size={15} /> : <MaterialIcon name={ts.icon} size={17} weight={500} />}
    </span>
  );
}

// A reel's goals: tap to change.
function GoalCell({ goals: allGoals, onChange }: { goals: ReelGoal[]; onChange: (g: ReelGoal[]) => void }) {
  const goals = allGoals.filter((g) => GOALS.some((o) => o.value === g));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    if (pos) return setPos(null);
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 200), left: Math.max(8, Math.min(r.left - 60, window.innerWidth - 170)) });
  };
  return (
    <div className="justify-self-center">
      <button ref={btn} type="button" onClick={toggle} title={goals.length ? goals.map((g) => GOALS.find((o) => o.value === g)?.label).join(" + ") : "Set Goal"} className="flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-full border border-dashed border-[#D4D4D2] px-1.5 hover:border-[#FF1F8F]" style={{ borderStyle: goals.length ? "solid" : "dashed", borderColor: goals.length ? "#FFC2E0" : undefined, background: goals.length ? "#FFF0F7" : undefined }}>
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
            <div style={{ top: pos.top, left: pos.left }} className="fixed z-[101] flex w-[170px] flex-col rounded-lg border border-[#E4E4E2] bg-white py-1 shadow-[0_12px_32px_rgba(13,13,13,0.18)]">
              <span className="px-3 pt-1.5 pb-1 text-[11px] font-extrabold tracking-[0.04em] text-[#6b6b69] uppercase">Choose Your Goal</span>
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

// the sort choices shared with the Library: dates, views, comments, shares, likes, length
const SORT_CHOICES: { value: string; label: string }[] = [
  { value: "analyzedAt", label: "Date Analyzed" },
  { value: "posted", label: "Date Posted" },
  { value: "views", label: "Views" },
  { value: "comments", label: "Comments" },
  { value: "shares", label: "Shares" },
  { value: "likes", label: "Likes" },
  { value: "length", label: "Length" },
];

export type CreatorBoard = { id: string; name: string; isFavorites: boolean; count: number };

export function CreatorClient({ username, avatar, reels: allReels, types: initialTypes, boards: initialBoards, favorite }: { username: string; avatar: string | null; reels: CreatorReel[]; types: ContentType[]; boards: CreatorBoard[]; favorite: boolean }) {
  const router = useRouter();
  // posts deleted here disappear at once (with a few seconds to undo) before the delete is saved
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const reels = useMemo(() => allReels.filter((r) => !deleted.has(r.id)), [allReels, deleted]);
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
  const [viewsStage, setViewsStage] = useState<StageKey>("all");
  const [viewsMin, setViewsMin] = useState("");
  const [viewsMax, setViewsMax] = useState("");
  const [rateStage, setRateStage] = useState<StageKey>("all");
  const [rateMin, setRateMin] = useState("");
  const [rateMax, setRateMax] = useState("");
  const [outStage, setOutStage] = useState<StageKey>("all");
  const [outMin, setOutMin] = useState("");
  const [outMax, setOutMax] = useState("");
  const viewsBounds = stageBounds(viewsStage, VIEW_STAGES, parseCount(viewsMin), parseCount(viewsMax));
  const rateBounds = stageBounds(rateStage, RATE_STAGES, parsePercent(rateMin), parsePercent(rateMax));
  const outBounds = stageBounds(outStage, OUTLIER_STAGES, parseTimes(outMin), parseTimes(outMax));
  const [favFilter, setFavFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [perPage, setPerPage] = useRememberedState("vh-creator-perPage", 50);
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [goalMap, setGoalMap] = useState<Record<string, ReelGoal[]>>({});
  const [typeMap, setTypeMap] = useState<Record<string, string[]>>({});
  const [tagOpen, setTagOpen] = useState(false);
  const [tagPick, setTagPick] = useState<Set<string>>(new Set());
  const [suggestIds, setSuggestIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [boards, setBoards] = useState(initialBoards);
  const [favs, setFavs] = useState<Set<string>>(() => new Set(allReels.filter((r) => r.favorite).map((r) => r.id)));
  const [dialog, setDialog] = useState<"board" | "goal" | null>(null);
  const [pickedBoards, setPickedBoards] = useState<Set<string>>(new Set());
  const [namingBoard, setNamingBoard] = useState(false);
  const [pickedGoals, setPickedGoals] = useState<Set<ReelGoal>>(new Set());
  const [isRepulling, setIsRepulling] = useState(false);
  const [toast, setToast] = useState<{ message: string; undoIds?: string[] } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  function flash(message: string, undoIds?: string[]) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, undoIds });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  const goalsOf = (r: CreatorReel) => goalMap[r.id] ?? r.goals;
  const typesOf = (r: CreatorReel) => typeMap[r.id] ?? r.typeIds;
  const rateMeta = RATE_METRICS.find((m) => m.key === rateMetric)!;
  const outMeta = OUTLIER_GOALS.find((g) => g.key === outMetric)!;

  const typical = useMemo(() => typicalByGoal(reels.filter((r) => r.postType === "reel").map((r) => ({ views: r.views }))), [reels]);
  // carousels have no views, so they are scored on comments against that creator's other carousels
  const typicalCarousel = useMemo(() => typicalComments(reels.filter((r) => r.postType === "carousel").map((r) => ({ comments: r.comments }))), [reels]);
  const enough = typical[outMetric] != null;

  const rows = useMemo(() => {
    const base = reels.map((r) => ({
      r,
      rate: rateOf({ views: r.views, comments: r.comments }, rateMetric),
      out: r.postType === "carousel" ? (typicalCarousel ? r.comments / typicalCarousel : null) : r.postType === "reel" ? outlierOf({ views: r.views }, outMetric, typical) : null,
    }));
    const query = q.trim().toLowerCase();
    const cutoff = postedRange === "all" ? -Infinity : Date.now() - Number(postedRange) * 86400000;
    const filtered = base.filter((x) => {
      const goals = goalMap[x.r.id] ?? x.r.goals;
      const ids = typeMap[x.r.id] ?? x.r.typeIds;
      if (formatFilter !== "all" && (formatFilter === "reel") !== (x.r.postType === "reel")) return false;
      // carousels have no view counts, so a views or Engagement rate filter leaves them out
      if (viewsBounds && (x.r.postType === "carousel" || x.r.views < viewsBounds[0] || x.r.views >= viewsBounds[1])) return false;
      if (rateBounds) {
        const rt = x.r.postType !== "carousel" && x.r.views > 0 ? x.r.comments / x.r.views : null;
        if (rt == null || rt < rateBounds[0] || rt >= rateBounds[1]) return false;
      }
      if (outBounds && (x.out == null || x.out < outBounds[0] || x.out >= outBounds[1])) return false;
      if (favFilter === "posts" && !x.r.favorite) return false;
      if (analyzedFilter !== "all" && (analyzedFilter === "yes") !== x.r.analyzed) return false;
      if (goalFilter !== "all" && (goalFilter === "none" ? goals.length > 0 : !goals.includes(goalFilter as ReelGoal))) return false;
      if (postedRange !== "all" && (!x.r.postedAt || new Date(x.r.postedAt).getTime() < cutoff)) return false;
      if (typeFilter.length > 0 && !((typeFilter.includes(UNTAGGED) && ids.length === 0) || typeFilter.some((t) => t !== UNTAGGED && ids.includes(t)))) return false;
      return !query || matchesSearch(`${x.r.caption} ${x.r.preview}`, query);
    });
    const val = (x: (typeof base)[number]): number =>
      sort.key === "posted" ? (x.r.postedAt ? new Date(x.r.postedAt).getTime() : 0)
        : sort.key === "analyzedAt" ? (x.r.analyzed ? new Date(x.r.analyzedAt).getTime() : 0)
        : sort.key === "views" ? x.r.views
        : sort.key === "likes" ? x.r.likes
        : sort.key === "comments" ? x.r.comments
        : sort.key === "shares" ? (x.r.shares ?? -1)
        : sort.key === "length" ? (x.r.durationSeconds ?? -1)
        : sort.key === "rate" ? (x.rate ?? -1)
        : sort.key === "analyzed" ? Number(x.r.analyzed)
        : sort.key === "goal" ? (goalMap[x.r.id] ?? x.r.goals).length
        : (x.out ?? -1);
    return filtered.sort((a, b) => (val(a) - val(b)) * sort.dir);
  }, [reels, rateMetric, outMetric, typical, typicalCarousel, q, analyzedFilter, goalFilter, postedRange, typeFilter, formatFilter, favFilter, sort, goalMap, typeMap, viewsBounds, rateBounds, outBounds]);

  const analyzedCount = reels.filter((r) => r.analyzed).length;
  // anything being analyzed (from any page) keeps refreshing until it's done
  const anyAnalyzing = reels.some((r) => r.analyzing);
  useEffect(() => {
    if (!anyAnalyzing) return;
    const t = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(t);
  }, [anyAnalyzing, router]);
  const best = reels.reduce((m, r) => (r.views > m.views ? r : m), reels[0]);
  const sharedReels = reels.filter((r) => r.shares != null);
  const mostShared = sharedReels.length ? sharedReels.reduce((m, r) => ((r.shares ?? 0) > (m.shares ?? 0) ? r : m), sharedReels[0]) : null;
  const filtersOn = q !== "" || analyzedFilter !== "all" || goalFilter !== "all" || postedRange !== "all" || typeFilter.length > 0 || formatFilter !== "all" || favFilter !== "all" || !!viewsBounds || !!rateBounds || !!outBounds;
  const toAnalyze = reels.filter((r) => picked.has(r.id) && !r.analyzed);
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const shownRows = rows.slice((currentPage - 1) * perPage, currentPage * perPage);
  const winStart = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const pageButtons: number[] = [];
  for (let n = winStart; n <= Math.min(pageCount, winStart + 4); n++) pageButtons.push(n);

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
    return (
      <button type="button" title={tip ?? label} aria-label={tip ?? label} onClick={() => sortBy(k)} className="flex items-center justify-center justify-self-center gap-0.5 whitespace-nowrap text-[#0D0D0D] hover:text-[#FF1F8F]">
        {icon === "target" ? <GoalIcon size={18} /> : icon ? <MaterialIcon name={icon} size={18} weight={500} /> : label} <MaterialIcon name={arrowFor(k)} size={15} />
      </button>
    );
  }

  function toggleFavorite(ids: string[], on: boolean) {
    setFavs((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    setFavorite(ids, on).catch(() => {
      flash("Couldn't update Favorites");
      router.refresh();
    });
    flash(on ? "Added to Favorites" : "Removed from Favorites");
  }
  function addToBoards(boardIds: string[], ids: string[]) {
    const targets = boards.filter((b) => boardIds.includes(b.id));
    if (targets.length === 0 || ids.length === 0) return;
    const noun = ids.length === 1 ? "reel" : "reels";
    for (const board of targets) {
      if (board.isFavorites) toggleFavorite(ids, true);
      else addReelsToBoard(board.id, ids).then(() => router.refresh()).catch(() => flash("Couldn't add to the board"));
    }
    flash(targets.length === 1 ? `Added ${ids.length} ${noun} to "${targets[0].name}"` : `Added ${ids.length} ${noun} to ${targets.length} boards`);
    setPicked(new Set());
  }
  function bulkGoal(goals: ReelGoal[]) {
    const ids = [...picked];
    if (ids.length === 0 || goals.length === 0) return;
    setGoalMap((prev) => {
      const next = { ...prev };
      ids.forEach((id) => (next[id] = goals));
      return next;
    });
    setReelGoalsBulk(ids, goals).catch(() => flash("Couldn't save the goal"));
    setPicked(new Set());
    flash(`Goal set to ${goals.map((g) => GOALS.find((o) => o.value === g)?.label).join(" + ")} on ${ids.length} ${ids.length === 1 ? "reel" : "reels"}`);
  }
  function handleRepull() {
    const ids = [...picked];
    if (ids.length === 0) return;
    const urls = allReels.filter((r) => ids.includes(r.id)).map((r) => r.url);
    setIsRepulling(true);
    repullReels(urls)
      .then((result) => {
        flash(result.failed.length ? `${result.updated} re-pulled, ${result.failed.length} failed` : `${result.updated} ${result.updated === 1 ? "reel" : "reels"} re-pulled with fresh data`);
        router.refresh();
      })
      .catch(() => flash("Something went wrong re-pulling"))
      .finally(() => {
        setIsRepulling(false);
        setPicked(new Set());
      });
  }
  function commitDelete(ids: string[]) {
    deleteReels(ids).catch(() => {});
    ids.forEach((id) => deleteTimers.current.delete(id));
  }
  function handleDelete(ids: string[]) {
    setDeleted((prev) => new Set([...prev, ...ids]));
    setPicked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    const timer = setTimeout(() => commitDelete(ids), 4000);
    ids.forEach((id) => deleteTimers.current.set(id, timer));
    flash(ids.length === 1 ? "Reel deleted" : `${ids.length} reels deleted`, ids);
  }
  function undoDelete() {
    const ids = toast?.undoIds ?? [];
    ids.forEach((id) => {
      const timer = deleteTimers.current.get(id);
      if (timer) clearTimeout(timer);
      deleteTimers.current.delete(id);
    });
    setDeleted((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setToast(null);
  }
  // What Download saves: this creator's posts as filtered and sorted, with the same columns as the Library's file.
  async function exportData() {
    const texts = await getExportTexts(rows.map((x) => x.r.id));
    const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "");
    const typeName = new Map(typeList.map((t) => [t.id, t.name]));
    const columns = ["Hook", "Creator", "Network", "Format", "Posted", "Views", "Comments", "Engagement rate", "Likes", "Outlier score", "Length", "Link", "Goal", "Content type", "Boards", "Favorite", "Analyzed", "Body", "Call to action", "Caption", "Transcript", "Shares"];
    const items = rows.map(({ r, rate, out }) => {
      const t = texts[r.id] ?? { transcript: "", hook: "", body: "", cta: "" };
      const hook = t.hook || r.preview;
      return {
        hook,
        r,
        t,
        row: [
          hook,
          "@" + username,
          "Instagram",
          r.postType === "carousel" ? "Carousel" : "Reel",
          date(r.postedAt),
          String(r.views),
          String(r.comments),
          rate == null ? "" : fmtRate(rate),
          r.likes < 0 ? "" : String(r.likes),
          out == null ? "" : out.toFixed(1) + "x",
          r.durationSeconds ? Math.round(r.durationSeconds) + "s" : "",
          r.url,
          goalsOf(r).join(", "),
          typesOf(r).map((id) => typeName.get(id) ?? "").filter(Boolean).join(", "),
          r.boardNames.join(", "),
          favs.has(r.id) ? "Yes" : "",
          r.analyzed ? date(r.analyzedAt) : "",
          t.body,
          t.cta,
          r.caption,
          t.transcript,
          r.shares == null ? "" : String(r.shares),
        ],
      };
    });
    return {
      title: "@" + username,
      filename: username + " " + new Date().toISOString().slice(0, 10),
      columns,
      rows: items.map((i) => i.row),
      widths: [44, 18, 12, 10, 14, 12, 12, 14, 10, 12, 9, 40, 14, 20, 20, 9, 14, 50, 30, 50, 80, 9],
      docs: items.map((i) => ({
        heading: i.hook.split(/\s+/).slice(0, 14).join(" ") || "Untitled",
        meta: [i.row[1], i.row[3], i.row[4] && "Posted " + i.row[4], i.row[5] + " views", i.row[6] + " comments", i.row[21] && i.row[21] + " shares", i.row[7] && i.row[7] + " engagement"].filter(Boolean).join(" · "),
        body: [
          "Link: " + i.row[11],
          i.row[8] && "Likes: " + i.row[8],
          i.row[9] && "Outlier score: " + i.row[9],
          i.row[10] && "Length: " + i.row[10],
          i.row[12] && "Goal: " + i.row[12],
          i.row[13] && "Content type: " + i.row[13],
          i.row[14] && "Boards: " + i.row[14],
          i.hook && "Hook: " + i.hook,
          i.t.body && "Body: " + i.t.body,
          i.t.cta && "Call to action: " + i.t.cta,
          i.r.caption && "Caption: " + i.r.caption,
          i.t.transcript && "Transcript:\n" + i.t.transcript,
        ].filter(Boolean).join("\n"),
      })),
    };
  }

  async function analyzePicked() {
    if (toAnalyze.length === 0 || busy) return;
    const ids = toAnalyze.map((r) => r.id);
    setBusy(true);
    setError(null);
    setAnalyzingIds((prev) => new Set([...prev, ...ids]));
    setPicked(new Set());
    try {
      // runs on the server, so it keeps going even if you leave this page
      await startAnalysis(toAnalyze.map((r) => r.url));
      router.refresh();
    } catch (e) {
      setError(e instanceof TypeError ? "Lost the connection. It may have finished, so refresh to check." : e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
      // the server now marks them as analyzing; drop the local marks once that has come through
      setTimeout(() => setAnalyzingIds((prev) => new Set([...prev].filter((x) => !ids.includes(x)))), 2000);
    }
  }

  // The title is the hook once a post is analyzed, and the caption's first sentence or two until then (same as the Library)
  const caption = (r: CreatorReel, cls: string) => (
    <Link href={`/analyze-reel/reel/${r.id}`} prefetch={false} className={`${cls} hover:text-[#FF1F8F]`}>
      {r.preview || r.caption.split("\n")[0] || "(no caption)"}
    </Link>
  );

  const typeCell = (r: CreatorReel) => {
    const ids = typesOf(r);
    return (
      <TypeCell types={typeList} ids={ids} onChange={(v) => setTypes(r.id, v)} onTypesChange={setTypeList} onSuggest={() => setSuggestIds([r.id])} />
    );
  };

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <BackLink fallbackHref="/creators" label="Back to Creators" />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="flex min-w-0 items-center gap-3 max-md:w-full md:gap-4">
          <span className="relative size-[52px] flex-none overflow-hidden rounded-full bg-[#2b2b29] md:size-[88px]">
            {avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="absolute inset-0 size-full object-cover" />
            )}
          </span>
          <div className="min-w-0 flex-1 md:flex-none">
            <div className="flex items-center gap-1">
              <h1 className="flex min-w-0 items-center gap-1.5 text-[22px] leading-[1.05] font-black tracking-[-0.03em] md:truncate md:text-[44px] md:leading-[1]">
                @{username}
                <span className="inline-block size-2 flex-none rounded-full bg-[#C6FF3D] md:ml-1 md:size-2.5" />
              </h1>
              <span className="flex items-center gap-1 max-md:hidden">
                <FavoriteCreator username={username} initial={favorite} size={26} className="ml-auto inline-flex size-9 md:ml-2 md:size-11" />
                <DeleteCreator username={username} posts={reels.length} />
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between md:mt-1 md:block">
              <a href={`https://www.instagram.com/${username}/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-[#4a4a48] hover:text-[#FF1F8F] md:text-[13px]">
                Open on Instagram <MaterialIcon name="open_in_new" size={14} />
              </a>
              <span className="flex items-center gap-1 md:hidden">
                <FavoriteCreator username={username} initial={favorite} size={24} className="inline-flex size-9" />
                <DeleteCreator username={username} posts={reels.length} />
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-[12.5px] font-bold max-md:w-full md:ml-auto md:grid-cols-8">
          {[
            ["Reels", String(reels.length)],
            ["Analyzed", String(analyzedCount)],
            ["Avg views", fmtN(avgOf(reels.map((r) => r.views)))],
            ["Avg comments", fmtN(avgOf(reels.map((r) => r.comments)))],
            ["Avg shares", sharedReels.length ? fmtN(avgOf(sharedReels.map((r) => r.shares ?? 0))) : "—"],
            ["Avg likes", fmtN(avgOf(reels.filter((r) => r.likes >= 0).map((r) => r.likes)))],
          ].map(([l, v]) => (
            <span key={l} title={l === "Analyzed" ? TIP_ANALYZED : undefined} className="flex min-w-0 flex-col rounded-lg border border-[#F0F0F1] bg-white px-2.5 py-1.5 shadow-[0_4px_16px_rgba(13,13,13,0.06)] md:min-w-[88px] md:px-3 md:py-2">
              <span className="text-[9.5px] font-extrabold tracking-wide max-md:leading-tight md:whitespace-nowrap text-[#6b6b69] uppercase md:text-[10.5px]">{l}</span>
              <span className="text-[16px] font-black md:text-[18px]">{v}</span>
            </span>
          ))}
          {/* the most-viewed reel: its view count, and a link to its page */}
          <Link
            href={`/analyze-reel/reel/${best.id}`}
            title="Open the most viewed reel"
            className="group flex min-w-0 flex-col rounded-lg border border-[#F0F0F1] bg-white px-2.5 py-1.5 shadow-[0_4px_16px_rgba(13,13,13,0.06)] hover:border-[#FF1F8F] md:min-w-[88px] md:px-3 md:py-2"
          >
            <span className="flex items-center gap-0.5 text-[9.5px] font-extrabold tracking-wide max-md:leading-tight md:whitespace-nowrap text-[#6b6b69] uppercase md:gap-1 md:text-[10.5px]">
              Most viewed <MaterialIcon name="arrow_outward" size={10} className="leading-none group-hover:text-[#FF1F8F]" />
            </span>
            <span className="text-[18px] font-black">{fmtN(best.views)}</span>
          </Link>
          {/* the most shared reel: its share count, and a link to its page */}
          {mostShared ? (
            <Link
              href={`/analyze-reel/reel/${mostShared.id}`}
              title="Open the most shared reel"
              className="group flex min-w-0 flex-col rounded-lg border border-[#F0F0F1] bg-white px-2.5 py-1.5 shadow-[0_4px_16px_rgba(13,13,13,0.06)] hover:border-[#FF1F8F] md:min-w-[88px] md:px-3 md:py-2"
            >
              <span className="flex items-center gap-0.5 text-[9.5px] font-extrabold tracking-wide max-md:leading-tight md:whitespace-nowrap text-[#6b6b69] uppercase md:gap-1 md:text-[10.5px]">
                Most shared <MaterialIcon name="arrow_outward" size={10} className="leading-none group-hover:text-[#FF1F8F]" />
              </span>
              <span className="text-[18px] font-black">{fmtN(mostShared.shares ?? 0)}</span>
            </Link>
          ) : (
            <span className="flex min-w-0 flex-col rounded-lg border border-[#F0F0F1] bg-white px-2.5 py-1.5 shadow-[0_4px_16px_rgba(13,13,13,0.06)] md:min-w-[88px] md:px-3 md:py-2">
              <span className="text-[9.5px] font-extrabold tracking-wide max-md:leading-tight md:whitespace-nowrap text-[#6b6b69] uppercase md:text-[10.5px]">Most shared</span>
              <span className="text-[18px] font-black">—</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 rounded-lg border border-[#F0F0F1] bg-white p-3 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:px-6 md:py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-md border border-[#E4E4E2] px-3 focus-within:border-[#0D0D0D] max-md:basis-full max-md:gap-1.5 max-md:px-2.5">
            <MaterialIcon name="search" size={19} className="text-[#4a4a48]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search captions and hooks" autoComplete="off" className="min-w-0 flex-1 border-0 bg-transparent text-[14px] font-medium outline-none" />
          </div>
          <div className="max-md:order-2 max-md:min-w-0 max-md:flex-1 max-md:[&>button]:w-full max-md:[&>button]:justify-center md:contents">
            <FilterPanel count={[analyzedFilter !== "all", goalFilter !== "all", postedRange !== "all", formatFilter !== "all", favFilter !== "all", typeFilter.length > 0, !!viewsBounds, !!rateBounds, !!outBounds].filter(Boolean).length} onClear={() => {
                setViewsStage("all");
                setViewsMin("");
                setViewsMax("");
                setRateStage("all");
                setRateMin("");
                setRateMax("");
                setOutStage("all");
                setOutMin("");
                setOutMax("");
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
                  <Dropdown prefix="Goal" value={goalFilter} onChange={setGoalFilter} options={[{ value: "all", label: "All" }, { value: "views", label: "Views" }, { value: "comments", label: "Comments" }, { value: "shares", label: "Shares" }, { value: "none", label: "None set" }]} className="w-full" />
                  <Dropdown prefix="Posted" value={postedRange} onChange={setPostedRange} options={[{ value: "all", label: "Any date" }, { value: "7", label: "Last 7 days" }, { value: "14", label: "Last 14 days" }, { value: "30", label: "Last 30 days" }, { value: "60", label: "Last 60 days" }, { value: "90", label: "Last 90 days" }]} className="w-full" />
                  <Dropdown prefix="Format" value={formatFilter} onChange={setFormatFilter} options={[{ value: "all", label: "All" }, { value: "reel", label: "Reels" }, { value: "carousel", label: "Carousels" }]} className="w-full" />
                  <Dropdown prefix="Favorites" value={favFilter} onChange={setFavFilter} options={[{ value: "all", label: "All" }, { value: "posts", label: "Favorite posts", short: "Posts" }]} className="w-full" />
                  <Dropdown prefix="Views" value={viewsStage} onChange={(v) => setViewsStage(v as StageKey)} options={VIEW_STAGE_OPTIONS} className="w-full" />
                  <Dropdown prefix="Engagement" value={rateStage} onChange={(v) => setRateStage(v as StageKey)} options={RATE_STAGE_OPTIONS} className="w-full" />
                  <Dropdown prefix="Outlier" value={outStage} onChange={(v) => setOutStage(v as StageKey)} options={OUTLIER_STAGE_OPTIONS} className="w-full" />
                  <TypeFilter types={typeList} onTypesChange={setTypeList} value={typeFilter} onChange={setTypeFilter} className="w-full" />
              </div>
              {(viewsStage === "custom" || rateStage === "custom" || outStage === "custom") && (
                <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-[12.5px] font-semibold text-[#4a4a48]">
                  {viewsStage === "custom" && (
                    <span className="flex items-center gap-1.5">
                      Views
                      <input value={viewsMin} onChange={(e) => setViewsMin(e.target.value)} placeholder="Min, like 10k" data-own-size className="h-8 w-[104px] rounded-md border border-[#E4E4E2] bg-white px-2 text-[12.5px] font-semibold text-[#0D0D0D] outline-none max-md:h-11 max-md:text-[16px]" />
                      to
                      <input value={viewsMax} onChange={(e) => setViewsMax(e.target.value)} placeholder="Max, like 1m" data-own-size className="h-8 w-[104px] rounded-md border border-[#E4E4E2] bg-white px-2 text-[12.5px] font-semibold text-[#0D0D0D] outline-none max-md:h-11 max-md:text-[16px]" />
                    </span>
                  )}
                  {outStage === "custom" && (
                    <span className="flex items-center gap-1.5">
                      Outlier
                      <input value={outMin} onChange={(e) => setOutMin(e.target.value)} placeholder="Min, like 2" inputMode="decimal" data-own-size className="h-8 w-[104px] rounded-md border border-[#E4E4E2] bg-white px-2 text-[12.5px] font-semibold text-[#0D0D0D] outline-none max-md:h-11 max-md:text-[16px]" />
                      to
                      <input value={outMax} onChange={(e) => setOutMax(e.target.value)} placeholder="Max, like 10" inputMode="decimal" data-own-size className="h-8 w-[104px] rounded-md border border-[#E4E4E2] bg-white px-2 text-[12.5px] font-semibold text-[#0D0D0D] outline-none max-md:h-11 max-md:text-[16px]" />
                      x
                    </span>
                  )}
                  {rateStage === "custom" && (
                    <span className="flex items-center gap-1.5">
                      Engagement %
                      <input value={rateMin} onChange={(e) => setRateMin(e.target.value)} placeholder="Min, like 0.5" inputMode="decimal" data-own-size className="h-8 w-[104px] rounded-md border border-[#E4E4E2] bg-white px-2 text-[12.5px] font-semibold text-[#0D0D0D] outline-none max-md:h-11 max-md:text-[16px]" />
                      to
                      <input value={rateMax} onChange={(e) => setRateMax(e.target.value)} placeholder="Max, like 2" inputMode="decimal" data-own-size className="h-8 w-[104px] rounded-md border border-[#E4E4E2] bg-white px-2 text-[12.5px] font-semibold text-[#0D0D0D] outline-none max-md:h-11 max-md:text-[16px]" />
                    </span>
                  )}
                </div>
              )}
            </FilterPanel>
          </div>
          <DownloadMenu className="max-md:order-2 max-md:min-w-0 max-md:flex-1 max-md:[&>button]:w-full max-md:[&>button]:justify-center" getData={exportData} />
          <button
            type="button"
            onClick={analyzePicked}
            disabled={busy || toAnalyze.length === 0}
            className="flex h-10 w-[148px] flex-none items-center justify-center gap-1.5 rounded-md bg-[#FF1F8F] px-4 text-[13px] font-extrabold whitespace-nowrap text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60 max-md:hidden"
          >
            {busy ? <EqualizerIcon size={15} /> : <MaterialIcon name="graphic_eq" size={17} weight={500} />}
            {busy ? "Sending…" : `Analyze (${picked.size})`}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 md:gap-2.5">
        <div className="basis-full md:hidden">
          <SortControl
            fill
            options={SORT_CHOICES}
            value={SORT_CHOICES.some((o) => o.value === sort.key) ? sort.key : "posted"}
            onChange={(v) => setSort({ key: v as SortKey, dir: -1 })}
            asc={sort.dir === 1}
            onToggleAsc={() => setSort({ ...sort, dir: (sort.dir * -1) as 1 | -1 })}
            dateKeys={["posted", "analyzedAt"]}
          />
        </div>
        <Dropdown
          prefix="Sort"
          value={SORT_CHOICES.some((o) => o.value === sort.key) ? sort.key : "custom"}
          onChange={(v) => {
            if (v === "custom") return;
            setSort({ key: v as SortKey, dir: -1 });
            setPage(1);
          }}
          options={[...SORT_CHOICES, ...(SORT_CHOICES.some((o) => o.value === sort.key) ? [] : [{ value: "custom", label: "Column Order" }])]}
          className="min-w-0 flex-1 max-md:hidden md:w-[210px] md:flex-none"
        />
        <button
          type="button"
          onClick={() => setSort({ ...sort, dir: (sort.dir * -1) as 1 | -1 })}
          title={sort.key === "analyzedAt" || sort.key === "posted" ? (sort.dir === 1 ? "Oldest first" : "Newest first") : sort.dir === 1 ? "Lowest first" : "Highest first"}
          aria-label={sort.key === "analyzedAt" || sort.key === "posted" ? (sort.dir === 1 ? "Oldest first" : "Newest first") : sort.dir === 1 ? "Lowest first" : "Highest first"}
          className="flex size-9 max-md:hidden flex-none items-center justify-center text-[#0D0D0D] hover:text-[#FF1F8F]"
        >
          <MaterialIcon name={sort.dir === 1 ? "arrow_upward" : "arrow_downward"} size={18} weight={500} />
        </button>
        <span className="ml-auto flex flex-none items-center gap-3">
          <ViewToggle value={view === "board" ? "grid" : "list"} onChange={(v) => setView(v === "grid" ? "board" : "list")} />
          <span className="text-[12px] font-semibold whitespace-nowrap text-[#6b6b69] md:text-[12.5px]">
            {rows.length} {rows.length === 1 ? "post" : "posts"}
          </span>
        </span>
      </div>

      {picked.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-col gap-2 rounded-lg border border-[#E4E4E2] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#0D0D0D] shadow-[0_8px_24px_rgba(13,13,13,0.12)]">
          <div className="flex flex-wrap items-center gap-1 max-md:justify-between">
            <span className="mr-2 font-extrabold whitespace-nowrap">{picked.size} selected</span>
            {isRepulling && (
              <span className="mr-2 flex items-center gap-1.5 rounded-full bg-[#FFD9EB] px-2.5 py-1 text-xs font-bold whitespace-nowrap text-[#FF1F8F]">
                <EqualizerIcon size={13} />
                Re-pulling {picked.size} {picked.size === 1 ? "reel" : "reels"}… this can take a minute
              </span>
            )}
            <IconAction tipBelow icon={<AddToBoardIcon />} label="Add to board" onClick={() => { setPickedBoards(new Set()); setDialog("board"); }} />
            <IconAction tipBelow icon="category" label="Set content type" onClick={() => { setTagPick(new Set()); setTagOpen(true); }} />
            <IconAction tipBelow icon={<GoalIcon />} label="Set goal" onClick={() => { setPickedGoals(new Set()); setDialog("goal"); }} />
            <IconAction tipBelow icon="favorite" filled={[...picked].every((id) => favs.has(id))} label={[...picked].every((id) => favs.has(id)) ? "Remove from Favorites" : "Favorite"} onClick={() => { toggleFavorite([...picked], !([...picked].every((id) => favs.has(id)))); setPicked(new Set()); }} />
            <IconAction tipBelow icon={isRepulling ? <EqualizerIcon size={16} /> : "refresh"} label={isRepulling ? "Re-pulling…" : "Re-pull (fresh stats)"} disabled={isRepulling} onClick={handleRepull} />
            <IconAction tipBelow icon="delete" label="Delete" onClick={() => handleDelete([...picked])} />
            <IconAction tipBelow icon="deselect" label="Clear selection" onClick={() => setPicked(new Set())} />
          </div>
          <button
            type="button"
            disabled={busy || toAnalyze.length === 0}
            onClick={analyzePicked}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-md bg-[#FF1F8F] px-4 text-[14px] font-extrabold whitespace-nowrap text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60 md:hidden"
          >
            {busy ? <EqualizerIcon size={15} /> : <MaterialIcon name="graphic_eq" size={17} weight={500} />}
            {busy ? "Sending…" : toAnalyze.length === 0 ? "Already analyzed" : `Analyze (${toAnalyze.length})`}
          </button>
        </div>
      )}
      {error && <p className="text-[13px] font-semibold text-[#D10A6E]">{error}</p>}

      {view === "list" ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)] max-md:hidden">
            <div className="min-w-[1180px]">
              <div className={`grid ${GRID} items-center gap-2 border-b border-[#F0F0F1] bg-[#FBFBFA] px-6 py-2.5 text-xs font-bold text-[#4a4a48]`}>
                {(() => {
                  const all = shownRows.length > 0 && shownRows.every((x) => picked.has(x.r.id));
                  const some = !all && shownRows.some((x) => picked.has(x.r.id));
                  return (
                    <button type="button" onClick={() => setPicked(all ? new Set() : new Set(shownRows.map((x) => x.r.id)))} aria-label="Select all shown">
                      <span className="flex size-4 items-center justify-center rounded-[3px] border-[1.5px]" style={{ background: all || some ? "#0D0D0D" : "#FFFFFF", borderColor: all || some ? "#0D0D0D" : "#BDBDBB" }}>
                        {(all || some) && <MaterialIcon name={all ? "check" : "remove"} size={12} className="text-white" />}
                      </span>
                    </button>
                  );
                })()}
                <span style={{ gridColumn: "span 3" }}>Post</span>
                {head("posted", "Posted")}
                {head("analyzedAt", "Analyzed")}
                {head("length", "Length", "av_timer", "Length")}
                {head("views", "Views", "visibility", "Views")}
                {head("likes", "Likes", "favorite", "Likes")}
                {head("comments", "Comments", "comment", "Comments")}
                {head("shares", "Shares", "send", "Shares")}
                {head("rate", "Engagement", "bolt", "Engagement rate")}
                {head("outlier", "Outlier", "rocket_launch", OUTLIER_COLUMN_TIP)}
                {head("analyzed", "Analyzed", "check_circle", "Analyzed")}
                {head("goal", "Goal", "target", "Goal")}
              </div>
              {rows.length === 0 && <div className="px-5 py-12 text-center text-sm font-medium text-[#4a4a48]">No reels match these filters.</div>}
              {shownRows.map(({ r, rate, out }) => (
                <div key={r.id} className={`relative grid ${GRID} items-center gap-2 border-b border-[#F0F0F1] px-6 py-2 text-[13px] font-normal text-[#0D0D0D] [font-variant-numeric:tabular-nums] last:border-b-0 hover:bg-[#FBFBFA]`} style={{ background: picked.has(r.id) ? "#F0F0F1" : undefined }}>
                  <button type="button" onClick={() => togglePick(r.id)} aria-label="Select post">
                    <span className="flex size-4 items-center justify-center rounded-[3px] border-[1.5px]" style={{ background: picked.has(r.id) ? "#0D0D0D" : "#FFFFFF", borderColor: picked.has(r.id) ? "#0D0D0D" : "#BDBDBB" }}>
                      {picked.has(r.id) && <MaterialIcon name="check" size={12} className="text-white" />}
                    </span>
                  </button>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" title={r.postType === "reel" ? "Reel. View on Instagram" : "Carousel. View on Instagram"} className="flex items-center justify-center">
                    {r.postType === "reel" ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF1F8F" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="5" />
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="17.5" cy="6.5" r="1.2" fill="#FF1F8F" stroke="none" />
                      </svg>
                    ) : (
                      <MaterialIcon name="collections" size={19} className="text-[#2F6BFF]" />
                    )}
                  </a>
                  <ReelThumb url={r.thumbnailUrl} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link href={`/analyze-reel/reel/${r.id}`} prefetch={false} className="truncate text-sm font-medium text-[#0D0D0D] hover:text-[#FF1F8F] hover:underline">
                      {r.preview || "(no caption)"}
                    </Link>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                      {typeCell(r)}
                      {r.boardNames.length > 0 && (
                        <span title={`In: ${r.boardNames.join(", ")}`} className="flex flex-none items-center text-[#4a4a48]">
                          <MaterialIcon name="folder" size={15} />
                        </span>
                      )}
                      {r.favorite && (
                        <span title="In Favorites" className="msym flex-none select-none text-[#FF1F8F]" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                          favorite
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="justify-self-center text-center whitespace-nowrap">{fmtDate(r.postedAt)}</span>
                  <span className="justify-self-center text-center whitespace-nowrap">{r.analyzed ? fmtDate(r.analyzedAt) : "—"}</span>
                  <span className="justify-self-center text-center">{fmtLen(r.durationSeconds)}</span>
                  <span className="justify-self-center text-center">{fmtN(r.views)}</span>
                  <span className="justify-self-center text-center">{r.likes < 0 ? "—" : fmtN(r.likes)}</span>
                  <span className="justify-self-center text-center">{fmtN(r.comments)}</span>
                  <span className="justify-self-center text-center">{optN(r.shares)}</span>
                  <span className="justify-self-center text-center" title={rateMeta.tip} style={{ color: rate == null ? "#9a9a98" : undefined }}>{fmtRate(rate)}</span>
                  <span className="flex justify-center justify-self-center">{out == null ? <span title={outlierNeedsTip(r.postType)} className="text-[#9a9a98]">—</span> : <OutlierBadge value={out} metric={outMetric} />}</span>
                  <StatusIcon reel={r} working={analyzingIds.has(r.id) || r.analyzing} />
                  <GoalCell goals={goalsOf(r)} onChange={(g) => setGoals(r.id, g)} />
                </div>
              ))}
            </div>
          </div>
          {/* phones: the same stacked rows as the Library, so there is nothing to scroll sideways */}
          <div className="overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:hidden">
            <div className="flex items-center gap-2.5 border-b border-[#F0F0F1] bg-[#FBFBFA] px-3 py-2 text-xs font-bold text-[#4a4a48]">
              {(() => {
                const all = shownRows.length > 0 && shownRows.every((x) => picked.has(x.r.id));
                const some = !all && shownRows.some((x) => picked.has(x.r.id));
                return (
                  <button type="button" onClick={() => setPicked(all ? new Set() : new Set(shownRows.map((x) => x.r.id)))} aria-label="Select all shown" className="flex items-center gap-2.5">
                    <span className="flex size-4 items-center justify-center rounded-[3px] border-[1.5px]" style={{ background: all || some ? "#0D0D0D" : "#FFFFFF", borderColor: all || some ? "#0D0D0D" : "#BDBDBB" }}>
                      {(all || some) && <MaterialIcon name={all ? "check" : "remove"} size={12} className="text-white" />}
                    </span>
                    Select all
                  </button>
                );
              })()}
            </div>
            {rows.length === 0 && <div className="px-3 py-10 text-center text-[13px] font-medium text-[#4a4a48]">No reels match these filters.</div>}
            {shownRows.map(({ r, rate, out }) => {
              const on = picked.has(r.id);
              const working = analyzingIds.has(r.id) || r.analyzing;
              return (
                <div key={r.id} className="flex items-start gap-2.5 border-b border-[#F0F0F1] px-3 py-2.5 last:border-b-0" style={{ background: on ? "#F0F0F1" : "#FFFFFF" }}>
                  <button type="button" onClick={() => togglePick(r.id)} aria-label="Select post" className="mt-1 flex-none">
                    <span className="flex size-4 items-center justify-center rounded-[3px] border-[1.5px]" style={{ background: on ? "#0D0D0D" : "#FFFFFF", borderColor: on ? "#0D0D0D" : "#BDBDBB" }}>
                      {on && <MaterialIcon name="check" size={12} className="text-white" />}
                    </span>
                  </button>
                  <div className="flex flex-none flex-col items-center gap-1.5">
                    <Link href={`/analyze-reel/reel/${r.id}`} prefetch={false}>
                      <ReelThumb url={r.thumbnailUrl} className="max-md:h-[68px] max-md:w-[52px] max-md:rounded-md" />
                    </Link>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" title={r.postType === "reel" ? "Reel. View on Instagram" : "Carousel. View on Instagram"} className="flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap text-[#4a4a48]">
                      <MaterialIcon name={r.postType === "reel" ? "smart_display" : "collections"} size={14} className={r.postType === "reel" ? "text-[#FF1F8F]" : "text-[#2F6BFF]"} />
                      {fmtDate(r.postedAt)}
                    </a>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link href={`/analyze-reel/reel/${r.id}`} prefetch={false} className="line-clamp-2 text-[13px] leading-[1.3] font-semibold text-[#0D0D0D]">
                      {r.preview || "(no caption)"}
                    </Link>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(3.9rem,1fr))] gap-x-1 gap-y-1.5 pr-1 text-[11px] leading-none">
                      {(
                        [
                          ["visibility", r.postType === "reel" ? fmtN(r.views) : "—"],
                          ["favorite", r.likes < 0 ? "—" : fmtN(r.likes)],
                          ["comment", fmtN(r.comments)],
                          ["send", optN(r.shares)],
                          ["av_timer", fmtLen(r.durationSeconds)],
                          ["bolt", fmtRate(rate)],
                          ["rocket_launch", fmtOutlier(out)],
                        ] as const
                      ).map(([icon, value]) => (
                        <span key={icon} className="flex items-center gap-0.5 whitespace-nowrap">
                          <MaterialIcon name={icon} size={12} className="flex-none text-[#4a4a48]" />
                          <span>{value}</span>
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                      {typeCell(r)}
                      {r.boardNames.length > 0 && (
                        <span title={`In: ${r.boardNames.join(", ")}`} className="flex h-7 w-6 flex-none items-center justify-center text-[#4a4a48]">
                          <MaterialIcon name="folder" size={17} />
                        </span>
                      )}
                      {r.favorite && (
                        <span title="In Favorites" className="flex h-7 w-5 flex-none items-center justify-center">
                          <span className="msym select-none text-[#FF1F8F]" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                            favorite
                          </span>
                        </span>
                      )}
                      <GoalCell goals={goalsOf(r)} onChange={(g) => setGoals(r.id, g)} />
                      <span
                        className="ml-auto flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-bold"
                        style={{ background: (working ? TS_META.processing : tsMetaFor(r)).bg, color: (working ? TS_META.processing : tsMetaFor(r)).fg }}
                      >
                        {working || r.transcriptionStatus === "processing" ? <EqualizerIcon size={12} /> : <MaterialIcon name={tsMetaFor(r).icon} size={14} weight={500} />}
                        {(working ? TS_META.processing : tsMetaFor(r)).label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        // Looks like their Instagram grid: a tile per post, with its numbers underneath.
        <div className="grid grid-cols-2 gap-3 md:gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {rows.length === 0 && <div className="col-span-full rounded-lg border border-[#F0F0F1] bg-white px-5 py-12 text-center text-sm font-medium text-[#4a4a48]">No reels match these filters.</div>}
          {shownRows.map(({ r }) => (
            <PostGridCard
              key={r.id}
              href={`/analyze-reel/reel/${r.id}`}
              thumbnailUrl={r.thumbnailUrl}
              postType={r.postType}
              views={r.views}
              comments={r.comments}
              shares={r.shares}
              durationSeconds={r.durationSeconds}
              creator={username}
              selected={picked.has(r.id)}
              onToggle={() => togglePick(r.id)}
              analyzing={analyzingIds.has(r.id) || r.analyzing}
            />
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-[#F0F0F1] bg-white px-3 py-3 shadow-[0_4px_16px_rgba(13,13,13,0.07)] md:gap-3.5 md:px-6">
          <div className="flex items-center gap-2.5 text-[12.5px] font-semibold text-[#4a4a48] max-md:text-[14px]">
            <span>
              {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, rows.length)} of {rows.length}
            </span>
            <span className="text-[#D4D4D2]">|</span>
            <span>Rows</span>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-[#E4E4E2] bg-white px-1 py-0.5 text-[12.5px] font-bold text-[#0D0D0D] outline-none max-md:py-1.5 max-md:text-[16px]"
            >
              {[5, 10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous page" onClick={() => currentPage > 1 && setPage(currentPage - 1)} className="flex size-8 items-center justify-center rounded hover:bg-[#F0F0F1] max-md:size-10" style={{ opacity: currentPage > 1 ? 1 : 0.3 }}>
              <MaterialIcon name="chevron_left" size={20} />
            </button>
            {pageButtons.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className="flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-[13px] font-bold hover:shadow-[inset_0_0_0_1px_#0D0D0D] max-md:h-10 max-md:min-w-10"
                style={{ background: n === currentPage ? "#0D0D0D" : "transparent", color: n === currentPage ? "#FBFBFA" : "#0D0D0D" }}
              >
                {n}
              </button>
            ))}
            <button type="button" aria-label="Next page" onClick={() => currentPage < pageCount && setPage(currentPage + 1)} className="flex size-8 items-center justify-center rounded hover:bg-[#F0F0F1] max-md:size-10" style={{ opacity: currentPage < pageCount ? 1 : 0.3 }}>
              <MaterialIcon name="chevron_right" size={20} />
            </button>
          </div>
        </div>
      )}

      {dialog === "board" && (
        <ActionDialog
          title={`Add ${picked.size} ${picked.size === 1 ? "reel" : "reels"} to a board`}
          onClose={() => setDialog(null)}
          confirmLabel="Add"
          confirmDisabled={pickedBoards.size === 0}
          onConfirm={() => {
            addToBoards([...pickedBoards], [...picked]);
            setDialog(null);
          }}
        >
          {boards.map((b) => (
            <DialogOption
              key={b.id}
              icon={b.isFavorites ? "favorite" : "folder"}
              filled
              label={b.name}
              hint={`${b.count} ${b.count === 1 ? "reel" : "reels"}`}
              selected={pickedBoards.has(b.id)}
              onSelect={() =>
                setPickedBoards((prev) => {
                  const next = new Set(prev);
                  if (next.has(b.id)) next.delete(b.id);
                  else next.add(b.id);
                  return next;
                })
              }
            />
          ))}
          <NewBoardOption onClick={() => setNamingBoard(true)} />
          <div className="px-6 pt-2 pb-1 text-xs font-semibold text-[#4a4a48]">Pick one or more boards. Reels stay in Library.</div>
        </ActionDialog>
      )}

      {namingBoard && (
        <NameDialog
          title="Create board"
          confirmLabel="Create"
          onClose={() => setNamingBoard(false)}
          onSubmit={(name) => {
            setNamingBoard(false);
            createBoard(name)
              .then((b) => {
                setBoards((prev) => [...prev, { id: b.id, name: b.name, isFavorites: false, count: 0 }]);
                setPickedBoards((prev) => new Set(prev).add(b.id));
                flash(`Board "${b.name}" created`);
              })
              .catch(() => flash("Couldn't create the board"));
          }}
        />
      )}

      {dialog === "goal" && (
        <ActionDialog
          title={`Set goal for ${picked.size} ${picked.size === 1 ? "reel" : "reels"}`}
          onClose={() => setDialog(null)}
          confirmLabel="Set goal"
          confirmDisabled={pickedGoals.size === 0}
          onConfirm={() => {
            bulkGoal([...pickedGoals]);
            setDialog(null);
          }}
        >
          {GOALS.map((g) => (
            <DialogOption
              key={g.value}
              icon={g.icon}
              label={g.label}
              selected={pickedGoals.has(g.value)}
              onSelect={() =>
                setPickedGoals((prev) => {
                  const next = new Set(prev);
                  if (next.has(g.value)) next.delete(g.value);
                  else next.add(g.value);
                  return next;
                })
              }
            />
          ))}
        </ActionDialog>
      )}

      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3.5 rounded-md bg-[#0D0D0D] px-4 py-3 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(13,13,13,0.3)] max-md:w-[calc(100vw-24px)] max-md:justify-center max-md:text-center">
          <span className="size-2 rounded-full bg-[#C6FF3D]" />
          <span>{toast.message}</span>
          {toast.undoIds && (
            <button type="button" onClick={undoDelete} className="font-extrabold text-[#E6FF00] underline decoration-2 underline-offset-[3px]">
              Undo
            </button>
          )}
        </div>
      )}

      {tagOpen && (
        <ActionDialog
          title={`Set Type For ${picked.size} ${picked.size === 1 ? "reel" : "reels"}`}
          onClose={() => setTagOpen(false)}
          confirmLabel="Add types"
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
              <button key={t.id} type="button" title={t.description || undefined} onClick={() => setTagPick((prev) => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next; })} className="flex items-center gap-3 px-6 py-1.5 text-left hover:bg-[#F6F6F5]">
                <span className="flex size-[18px] flex-none items-center justify-center rounded-[4px] border-[1.5px]" style={{ background: on ? "#0D0D0D" : "#fff", borderColor: on ? "#0D0D0D" : "#BDBDBB" }}>
                  {on && <MaterialIcon name="check" size={13} className="text-white" />}
                </span>
                <TypeChips types={typeList} ids={[t.id]} max={1} small={false} />
                <TypeInfo type={t} />
              </button>
            );
          })}
          <SuggestWithAiButton wide onClick={() => { setTagOpen(false); setSuggestIds([...picked]); }} />
        </ActionDialog>
      )}
      {suggestIds && (
        <SuggestDialog
          reels={reels.filter((r) => suggestIds.includes(r.id)).map((r) => ({ id: r.id, caption: r.caption, thumbnailUrl: r.thumbnailUrl }))}
          types={typeList}
          onTypesChange={setTypeList}
          onClose={() => setSuggestIds(null)}
          onApply={(picks) => {
            const byType = new Map<string, string[]>();
            for (const [rid, tids] of Object.entries(picks)) for (const tid of tids) byType.set(tid, [...(byType.get(tid) ?? []), rid]);
            for (const [tid, rids] of byType) addTypes(rids, [tid]);
            setSuggestIds(null);
            setPicked(new Set());
          }}
        />
      )}
    </div>
  );
}
