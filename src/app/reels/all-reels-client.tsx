"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelCover, ReelThumb } from "@/components/reel-thumb";
import { useColumnWidth } from "@/lib/use-column-width";
import { deleteReels, dismissFromNew, repullReels, setReelGoals, setReelGoalsBulk, type ReelGoal } from "./actions";
import { refreshTranscriptionStatus, transcribeSelectedReels } from "@/app/analyze-reel/[batchId]/actions";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { ExcludeCreators } from "@/components/exclude-creators";
import { OutlierFilter, OutlierBadge } from "@/components/outlier-filter";
import { Dropdown } from "@/components/dropdown";
import { SuggestDialog, TypeChips, TypeFilter, TypePicker, UNTAGGED, useTypes } from "@/components/types-ui";
import { addTypesToReels, setReelTypes } from "@/app/types/actions";
import type { ContentType } from "@/lib/content-types";
import type { Outliers } from "@/lib/creator-typicals";
import type { OutlierGoal } from "@/lib/outlier";
import { InsightsPanel } from "@/components/insights-panel";
import { addReelsToBoard, createBoard, setFavorite } from "./boards-actions";
import { ActionDialog, DialogOption, IconAction, NameDialog } from "@/components/action-dialog";
import { AddToBoardIcon, GoalIcon } from "@/components/bar-icons";

export type AllReelsRow = {
  id: string;
  url: string;
  caption: string | null;
  thumbnailUrl: string | null;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  postedAt: string | null;
  analyzedAt: string;
  views: number;
  likes: number;
  commentsCount: number;
  sharesCount: number | null;
  repostsCount: number | null;
  savesCount: number | null;
  durationSeconds: number | null;
  transcriptionStatus: string | null;
  noAudio: boolean;
  goals: ReelGoal[];
  typeIds: string[];
  outlier: Outliers;
  boardNames: string[];
  isSingle: boolean;
  isNew: boolean;
};

const GOAL_OPTIONS: { value: ReelGoal; label: string; icon: string }[] = [
  { value: "views", label: "Views", icon: "visibility" },
  { value: "shares", label: "Shares", icon: "send" },
  { value: "comments", label: "Comments", icon: "comment" },
  { value: "saves", label: "Saves", icon: "bookmark" },
];

type SortKey =
  | "postedAt"
  | "analyzedAt"
  | "durationSeconds"
  | "views"
  | "likes"
  | "commentsCount"
  | "sharesCount"
  | "repostsCount"
  | "savesCount"
  | "engagementRate"
  | "shareRate"
  | "outlier"
  | "transcript"
  | "goal";
type RangeKey = "all" | "7" | "14" | "30" | "90" | "custom";
type TstatKey = "all" | "done" | "not";
type GoalFilter = "all" | "none" | ReelGoal;

function gridCols(postWidth: number) {
  return `22px 20px 34px ${postWidth}px 70px 70px 54px repeat(6,minmax(56px,1fr)) 64px 64px 46px 66px`;
}

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
  return Math.round(n).toLocaleString("en-US");
}

function pct(n: number) {
  return n >= 0.1 ? (n * 100).toFixed(1) + "%" : (n * 100).toFixed(2) + "%";
}

function fmtShortDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

function fmtLen(seconds: number | null) {
  if (seconds == null) return "—";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const SORT_OPTIONS: { label: string; key: SortKey; dir: 1 | -1 }[] = [
  { label: "Most recently analyzed", key: "analyzedAt", dir: -1 },
  { label: "Oldest analyzed", key: "analyzedAt", dir: 1 },
  { label: "Most recently posted", key: "postedAt", dir: -1 },
  { label: "Oldest posted", key: "postedAt", dir: 1 },
  { label: "Most views", key: "views", dir: -1 },
  { label: "Most likes", key: "likes", dir: -1 },
  { label: "Most comments", key: "commentsCount", dir: -1 },
  { label: "Most shares", key: "sharesCount", dir: -1 },
  { label: "Most reposts", key: "repostsCount", dir: -1 },
  { label: "Most saves", key: "savesCount", dir: -1 },
  { label: "Longest", key: "durationSeconds", dir: -1 },
];
const SORT_STORAGE = "rc-allreels-sort";

const TS_META: Record<string, { label: string; bg: string; fg: string; icon: string; rank: number }> = {
  ready: { label: "Transcribed", bg: "#C6FF3D", fg: "#0D0D0D", icon: "check", rank: 2 },
  processing: { label: "Transcribing", bg: "#FFD9EB", fg: "#FF1F8F", icon: "graphic_eq", rank: 1 },
  error: { label: "Couldn't transcribe this reel", bg: "#F0F0F1", fg: "#6b6b69", icon: "block", rank: 1 },
};
const TS_NONE = { label: "Not transcribed yet", bg: "#F0F0F1", fg: "#9a9a98", icon: "remove", rank: 0 };

function tsMeta(status: string | null) {
  return (status && TS_META[status]) || TS_NONE;
}

// A reel with no spoken words isn't an error - it just has nothing to transcribe.
const TS_NO_AUDIO = { label: "No audio to transcribe", bg: "#F0F0F1", fg: "#6b6b69", icon: "volume_off", rank: 0 };
function tsMetaFor(r: { transcriptionStatus: string | null; noAudio: boolean }) {
  return r.noAudio ? TS_NO_AUDIO : tsMeta(r.transcriptionStatus);
}

export type BoardSummary = {
  id: string;
  name: string;
  isFavorites: boolean;
  count: number;
  thumbs: (string | null)[];
};

export function AllReelsClient({
  rows,
  boards: initialBoards,
  favoriteIds,
  types: initialTypes,
}: {
  rows: AllReelsRow[];
  boards: BoardSummary[];
  favoriteIds: string[];
  types: ContentType[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creator, setCreator] = useState<string[]>([]);
  const { types: typeList, setTypes: setTypeList } = useTypes(initialTypes);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [typeMap, setTypeMap] = useState<Record<string, string[]>>({});
  const [tagPick, setTagPick] = useState<Set<string>>(new Set());
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [outMetric, setOutMetric] = useState<OutlierGoal>("views");
  const [outMin, setOutMin] = useState(0);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [postedRange, setPostedRange] = useState<RangeKey>("all");
  const [postedFrom, setPostedFrom] = useState(isoDaysAgo(30));
  const [postedTo, setPostedTo] = useState(isoDaysAgo(0));
  const [analyzedRange, setAnalyzedRange] = useState<RangeKey>("all");
  const [analyzedFrom, setAnalyzedFrom] = useState(isoDaysAgo(30));
  const [analyzedTo, setAnalyzedTo] = useState(isoDaysAgo(0));
  const [tstat, setTstat] = useState<TstatKey>("all");
  const [goalFilter, setGoalFilter] = useState<GoalFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("analyzedAt");
  const [direction, setDirection] = useState<1 | -1>(-1);
  const sortLoaded = useRef(false);

  // Remember how you like the list organized.
  useEffect(() => {
    try {
      // desktop always opens on most recently analyzed; phones remember their pick
      if (!window.matchMedia("(max-width: 767px)").matches) throw new Error("desktop");
      const saved = JSON.parse(localStorage.getItem(SORT_STORAGE) ?? "null");
      if (saved && (saved.dir === 1 || saved.dir === -1) && typeof saved.key === "string") {
        setSortKey(saved.key as SortKey);
        setDirection(saved.dir);
      }
    } catch {}
    sortLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!sortLoaded.current) return;
    try {
      localStorage.setItem(SORT_STORAGE, JSON.stringify({ key: sortKey, dir: direction }));
    } catch {}
  }, [sortKey, direction]);
  const sortValue = SORT_OPTIONS.findIndex((o) => o.key === sortKey && o.dir === direction);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [goals, setGoals] = useState<Record<string, ReelGoal[]>>({});
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [favs, setFavs] = useState<Set<string>>(new Set(favoriteIds));
  const [boards, setBoards] = useState(initialBoards);
  useEffect(() => setBoards(initialBoards), [initialBoards]);
  const [newOnly, setNewOnly] = useState(false);
  const [namingBoard, setNamingBoard] = useState(false);
  const [dialog, setDialog] = useState<"board" | "goal" | "tag" | null>(null);
  const [pickedBoards, setPickedBoards] = useState<Set<string>>(new Set());
  const [pickedGoals, setPickedGoals] = useState<Set<ReelGoal>>(new Set());
  const [dropBoard, setDropBoard] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [toast, setToast] = useState<{ message: string; undoIds?: string[] } | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRepulling, setIsRepulling] = useState(false);
  const [repullIds, setRepullIds] = useState<Set<string>>(new Set());
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableW, setTableW] = useState(0);
  // Post can grow only as far as leaves each of the 11 data columns at least 68px, so nothing leaves the card.
  const fitPost = () => Math.max(260, tableW - 48 - 76 - 16 * 16 - 770);
  const { width: savedPostWidth, startDrag: startPostDrag } = useColumnWidth(
    "rc-allreels-post-w",
    440,
    260,
    4000,
    fitPost,
  );
  const postWidth = tableW ? Math.min(savedPostWidth, fitPost()) : savedPostWidth;

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const update = () => setTableW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function flash(message: string, undoIds?: string[]) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, undoIds });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  const typeIdsOf = (row: AllReelsRow) => (typeMap[row.id] !== undefined ? typeMap[row.id] : row.typeIds);
  function setTypesFor(id: string, ids: string[]) {
    setTypeMap((prev) => ({ ...prev, [id]: ids }));
    setReelTypes(id, ids).catch(() => flash("Couldn't save that tag"));
  }
  function addTypesTo(ids: string[], typeIds: string[]) {
    setTypeMap((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        const row = rows.find((r) => r.id === id);
        const cur = next[id] ?? row?.typeIds ?? [];
        next[id] = [...new Set([...cur, ...typeIds])];
      }
      return next;
    });
    addTypesToReels(ids, typeIds).catch(() => flash("Couldn't save the tags"));
  }
  // the little tag area under each reel: chips, and a button to change them
  const typesCell = (r: AllReelsRow) => {
    const ids = typeIdsOf(r);
    return (
      <TypePicker
        types={typeList}
        value={ids}
        onChange={(v) => setTypesFor(r.id, v)}
        onTypesChange={setTypeList}
        className="flex flex-none items-center rounded-md px-0.5 hover:bg-[#F0F0F1]"
      >
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

  function goalOf(row: AllReelsRow) {
    return goals[row.id] !== undefined ? goals[row.id] : row.goals;
  }

  function commitDelete(ids: string[]) {
    deleteReels(ids).catch(() => {
      // server delete failed silently; row stays hidden locally rather than
      // risking a confusing reappearance mid-session
    });
    ids.forEach((id) => deleteTimers.current.delete(id));
  }

  function handleDelete(ids: string[]) {
    setDeleted((prev) => new Set([...prev, ...ids]));
    setSelected((prev) => {
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
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }

  function handleGoalChange(id: string, next: ReelGoal[]) {
    setGoals((prev) => ({ ...prev, [id]: next }));
    setReelGoals(id, next).catch(() => {});
  }

  function handleBulkGoal(picked: ReelGoal[]) {
    const ids = [...selected];
    if (ids.length === 0 || picked.length === 0) return;
    setGoals((prev) => {
      const next = { ...prev };
      ids.forEach((id) => (next[id] = picked));
      return next;
    });
    setReelGoalsBulk(ids, picked).catch(() => {});
    setSelected(new Set());
    const label = picked.map((g) => GOAL_OPTIONS.find((o) => o.value === g)?.label).join(" + ");
    flash(`Goal set to ${label} on ${ids.length} ${ids.length === 1 ? "reel" : "reels"}`);
  }

  function handleTranscribe() {
    const ids = [...selected];
    if (ids.length === 0) {
      flash("Select reels to transcribe");
      return;
    }
    setIsTranscribing(true);
    setSentIds((prev) => new Set([...prev, ...ids]));
    transcribeSelectedReels(ids)
      .then(() => flash(`${ids.length} ${ids.length === 1 ? "reel" : "reels"} sent to transcription`))
      .catch(() => {
        setSentIds((prev) => new Set([...prev].filter((x) => !ids.includes(x))));
        flash("Something went wrong sending to transcription");
      })
      .finally(() => setIsTranscribing(false));
    setSelected(new Set());
  }

  function handleRepull() {
    const ids = [...selected];
    if (ids.length === 0) {
      flash("Select reels to re-pull");
      return;
    }
    const urls = rows.filter((r) => ids.includes(r.id)).map((r) => r.url);
    setIsRepulling(true);
    setRepullIds(new Set(ids));
    setSelected(new Set()); // the Re-pulling tags on the rows show what's running
    repullReels(urls)
      .then((result) => {
        flash(
          result.failed.length
            ? `${result.updated} re-pulled, ${result.failed.length} failed`
            : `${result.updated} ${result.updated === 1 ? "reel" : "reels"} re-pulled with fresh data`,
        );
        router.refresh();
      })
      .catch(() => flash("Something went wrong re-pulling"))
      .finally(() => {
        setIsRepulling(false);
        setRepullIds(new Set());
        setSelected(new Set());
      });
  }

  // Reels just sent to transcription show as "processing" right away, before
  // the server round trip comes back.
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const live = useMemo(
    () =>
      rows
        .filter((r) => !deleted.has(r.id))
        .map((r) =>
          sentIds.has(r.id) && r.transcriptionStatus !== "ready" ? { ...r, transcriptionStatus: "processing" } : r,
        ),
    [rows, deleted, sentIds],
  );

  // While anything is transcribing, check on it every 10 seconds so the
  // status flips to done by itself.
  const processingKey = live
    .filter((r) => r.transcriptionStatus === "processing")
    .map((r) => r.id)
    .slice(0, 30)
    .join(",");
  useEffect(() => {
    if (!processingKey) return;
    const ids = processingKey.split(",");
    const t = setInterval(() => {
      Promise.all(ids.map((id) => refreshTranscriptionStatus(id).catch(() => null))).then(() => router.refresh());
    }, 10000);
    return () => clearInterval(t);
  }, [processingKey, router]);

  const creators = useMemo(
    () =>
      Array.from(new Set(live.map((r) => r.ownerUsername).filter((u): u is string => Boolean(u)))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [live],
  );

  function rangeBounds(range: RangeKey, from: string, to: string) {
    if (range === "custom") {
      return { minTs: new Date(from + "T00:00:00").getTime(), maxTs: new Date(to + "T23:59:59").getTime() };
    }
    if (range === "all") return { minTs: -Infinity, maxTs: Infinity };
    const d = new Date();
    d.setDate(d.getDate() - Number(range));
    return { minTs: d.getTime(), maxTs: Infinity };
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const posted = rangeBounds(postedRange, postedFrom, postedTo);
    const analyzed = rangeBounds(analyzedRange, analyzedFrom, analyzedTo);
    return live.filter((r) => {
      if (newOnly && !r.isNew) return false;
      if (creator.length > 0 && !(r.ownerUsername && creator.includes(r.ownerUsername))) return false;
      if (outMin > 0 && (r.outlier[outMetric] ?? -1) < outMin) return false;
      if (r.ownerUsername && excluded.includes(r.ownerUsername)) return false;
      const postedTs = r.postedAt ? new Date(r.postedAt).getTime() : 0;
      if (postedTs < posted.minTs || postedTs > posted.maxTs) return false;
      const analyzedTs = new Date(r.analyzedAt).getTime();
      if (analyzedTs < analyzed.minTs || analyzedTs > analyzed.maxTs) return false;
      const done = r.transcriptionStatus === "ready";
      if (tstat === "done" && !done) return false;
      if (tstat === "not" && done) return false;
      if (typeFilter.length > 0) {
        const ids = typeIdsOf(r);
        const hit = (typeFilter.includes(UNTAGGED) && ids.length === 0) || typeFilter.some((t) => t !== UNTAGGED && ids.includes(t));
        if (!hit) return false;
      }
      if (goalFilter !== "all") {
        const g = goalOf(r);
        if (goalFilter === "none" ? g.length > 0 : !g.includes(goalFilter)) return false;
      }
      if (q) {
        const hit = (r.caption ?? "").toLowerCase().includes(q) || (r.ownerUsername ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, newOnly, query, creator, outMetric, outMin, excluded, typeFilter, typeMap, postedRange, postedFrom, postedTo, analyzedRange, analyzedFrom, analyzedTo, tstat, goalFilter, goals]);

  const sorted = useMemo(() => {
    const val = (r: AllReelsRow): number => {
      if (sortKey === "postedAt") return r.postedAt ? new Date(r.postedAt).getTime() : 0;
      if (sortKey === "analyzedAt") return new Date(r.analyzedAt).getTime();
      if (sortKey === "durationSeconds") return r.durationSeconds ?? -Infinity;
      if (sortKey === "transcript") return tsMetaFor(r).rank;
      if (sortKey === "goal") {
        const g = goalOf(r);
        const rank = { views: 1, shares: 2, comments: 3, saves: 4 } as Record<string, number>;
        return g.length ? Math.min(...g.map((x) => rank[x])) : 0;
      }
      if (sortKey === "sharesCount") return r.sharesCount ?? -Infinity;
      if (sortKey === "repostsCount") return r.repostsCount ?? -Infinity;
      if (sortKey === "savesCount") return r.savesCount ?? -Infinity;
      if (sortKey === "outlier") return r.outlier[outMetric] ?? -Infinity;
      if (sortKey === "engagementRate") return r.views > 0 ? r.commentsCount / r.views : -Infinity;
      if (sortKey === "shareRate") return r.views > 0 && r.repostsCount != null ? r.repostsCount / r.views : -Infinity;
      return r[sortKey] as number;
    };
    return [...filtered].sort((a, b) => (val(a) - val(b)) * direction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, direction, goals, outMetric]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * perPage, currentPage * perPage);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === 1 ? -1 : 1) as 1 | -1);
    } else {
      setSortKey(key);
      setDirection(-1);
    }
    setPage(1);
  }

  function arrowFor(key: SortKey) {
    if (sortKey !== key) return "unfold_more";
    return direction === -1 ? "expand_more" : "expand_less";
  }

  const pageAllSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const pageSomeSelected = !pageAllSelected && pageRows.some((r) => selected.has(r.id));
  const allMatchingSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((r) => (pageAllSelected ? next.delete(r.id) : next.add(r.id)));
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    setBoards((prev) =>
      prev.map((b) => {
        if (!b.isFavorites) return b;
        const delta = ids.filter((id) => favs.has(id) !== on).length;
        return { ...b, count: Math.max(0, b.count + (on ? delta : -delta)) };
      }),
    );
    setFavorite(ids, on)
      .then(() => router.refresh())
      .catch(() => {
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
      if (board.isFavorites) {
        toggleFavorite(ids, true);
      } else {
        addReelsToBoard(board.id, ids)
          .then(() => router.refresh())
          .catch(() => flash("Couldn't add to the board"));
      }
    }
    flash(
      targets.length === 1
        ? `Added ${ids.length} ${noun} to "${targets[0].name}"`
        : `Added ${ids.length} ${noun} to ${targets.length} boards`,
    );
    setSelected(new Set());
  }

  function startReelDrag(e: React.DragEvent, id: string) {
    const ids = selected.has(id) ? [...selected] : [id];
    e.dataTransfer.setData("application/x-reel-ids", JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "copy";
    const ghost = document.createElement("div");
    ghost.textContent = `${ids.length} ${ids.length === 1 ? "reel" : "reels"}`;
    ghost.style.cssText =
      "position:fixed;top:-100px;padding:8px 14px;background:#FF1F8F;color:#fff;font:700 13px Archivo,sans-serif;border-radius:8px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 10, 10);
    setTimeout(() => ghost.remove(), 0);
  }

  function dropOnBoard(e: React.DragEvent, boardId: string) {
    e.preventDefault();
    setDropBoard(null);
    try {
      const ids = JSON.parse(e.dataTransfer.getData("application/x-reel-ids")) as string[];
      addToBoards([boardId], ids);
    } catch {
      // not one of our drags
    }
  }

  function handleNewBoard(name: string) {
    setNamingBoard(false);
    createBoard(name)
      .then((b) => {
        setBoards((prev) => [...prev, { id: b.id, name: b.name, isFavorites: false, count: 0, thumbs: [] }]);
        flash(`Board "${b.name}" created`);
        router.refresh();
      })
      .catch(() => flash("Couldn't create the board"));
  }

  const [dismissedNew, setDismissedNew] = useState<Set<string>>(new Set());
  function removeFromNew(id: string) {
    setDismissedNew((prev) => new Set(prev).add(id));
    dismissFromNew(id).catch(() => {
      setDismissedNew((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      flash("Couldn't remove it from New");
    });
  }

  const newReels = useMemo(
    () =>
      live
        .filter((r) => r.isNew && !dismissedNew.has(r.id))
        .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()),
    [live, dismissedNew],
  );
  const allSelectedFavorited = selected.size > 0 && [...selected].every((id) => favs.has(id));
  const newRowRef = useRef<HTMLDivElement>(null);
  function scrollNew(dir: 1 | -1) {
    newRowRef.current?.scrollBy({ left: dir * 400, behavior: "smooth" });
  }

  const hasFilters =
    newOnly || !!query || creator.length > 0 || outMin > 0 || excluded.length > 0 || typeFilter.length > 0 || postedRange !== "all" || analyzedRange !== "all" || tstat !== "all" || goalFilter !== "all";
  function clearFilters() {
    setNewOnly(false);
    setQuery("");
    setCreator([]);
    setOutMin(0);
    setExcluded([]);
    setTypeFilter([]);
    setPostedRange("all");
    setAnalyzedRange("all");
    setTstat("all");
    setGoalFilter("all");
    setPage(1);
    setSelected(new Set());
  }

  function selectAllMatching() {
    setSelected(allMatchingSelected ? new Set() : new Set(filtered.map((r) => r.id)));
  }

  const winStart = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const pageButtons: number[] = [];
  for (let p = winStart; p <= Math.min(pageCount, winStart + 4); p++) pageButtons.push(p);

  const rangeText = sorted.length
    ? `${(currentPage - 1) * perPage + 1}–${Math.min(currentPage * perPage, sorted.length)} of ${sorted.length}`
    : "0 of 0";

  // Dates keep their words; every metric is an icon (hover shows its name) so the columns stay narrow.
  const sortCols: { label: string; key: SortKey; icon?: string; tip?: string; pct?: boolean }[] = [
    { label: "Posted", key: "postedAt" },
    { label: "Analyzed", key: "analyzedAt" },
    { label: "Length", key: "durationSeconds", icon: "av_timer", tip: "Length" },
    { label: "Views", key: "views", icon: "visibility", tip: "Views" },
    { label: "Likes", key: "likes", icon: "favorite", tip: "Likes" },
    { label: "Comments", key: "commentsCount", icon: "comment", tip: "Comments" },
    { label: "Shares", key: "sharesCount", icon: "send", tip: "Shares" },
    { label: "Reposts", key: "repostsCount", icon: "repeat", tip: "Reposts" },
    { label: "Saves", key: "savesCount", icon: "bookmark", tip: "Saves" },
    { label: "Engagement", key: "engagementRate", icon: "comment", tip: "Engagement rate (comments ÷ views)", pct: true },
    { label: "Share rate", key: "shareRate", icon: "repeat", tip: "Share rate (reposts ÷ views)", pct: true },
  ];

  function transcribeOne(id: string) {
    setSentIds((prev) => new Set(prev).add(id));
    transcribeSelectedReels([id])
      .then(() => flash("Reel sent to transcription"))
      .catch(() => {
        setSentIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        flash("Something went wrong sending to transcription");
      });
  }

  const circleBtn =
    "flex size-8 cursor-pointer items-center justify-center rounded-full border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)] hover:bg-[#0D0D0D] hover:text-white";

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <InsightsPanel reels={live.map((r) => ({ id: r.id, caption: r.caption, views: r.views, commentsCount: r.commentsCount, sharesCount: r.sharesCount }))} />

      <div className="-mb-2.5 flex flex-wrap items-baseline gap-2.5">
        <span className="text-[20px] md:text-[26px] font-black tracking-[-0.02em]">All</span>
        <span className="text-[13px] font-semibold text-[#4a4a48]">
          {newOnly ? "Showing only reels analyzed in the last 24 hours." : "Every reel you've analyzed."}
        </span>
      </div>

    <div className="flex flex-col overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-3 md:px-6 md:py-4">
        <div className="flex h-9 min-w-0 flex-1 basis-full items-center gap-2 rounded-md border border-[#E4E4E2] px-2.5 focus-within:border-[#0D0D0D] md:min-w-[220px] md:basis-[240px]">
          <MaterialIcon name="search" size={18} className="text-[#4a4a48]" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            setSelected(new Set());
            }}
            placeholder="Search reels, creators, captions…"
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium text-[#0D0D0D] outline-none"
          />
        </div>

        <ExcludeCreators
          compact
          variant="include"
          creators={creators}
          value={creator}
          onChange={(v) => {
            setCreator(v);
            setPage(1);
            setSelected(new Set());
          }}
          heightClass="h-9"
          className="w-[calc(50%-4px)] flex-none md:w-[150px]"
        />
        <ExcludeCreators
          compact
          creators={creators}
          value={excluded}
          onChange={(v) => {
            setExcluded(v);
            setPage(1);
            setSelected(new Set());
          }}
          heightClass="h-9"
          className="w-[calc(50%-4px)] flex-none md:w-[150px]"
        />
        <OutlierFilter metric={outMetric} min={outMin} onChange={(m, n) => { setOutMetric(m); setOutMin(n); setPage(1); setSelected(new Set()); }} />
        <Dropdown
          prefix="Transcript"
          value={tstat}
          onChange={(v) => {
            setTstat(v as TstatKey);
            setPage(1);
            setSelected(new Set());
          }}
          options={[
            { value: "all", label: "All" },
            { value: "done", label: "Done" },
            { value: "not", label: "Not yet" },
          ]}
          className="w-[calc(50%-4px)] flex-none md:w-[150px]"
        />
        <Dropdown
          prefix="Goal"
          value={goalFilter}
          onChange={(v) => {
            setGoalFilter(v as GoalFilter);
            setPage(1);
            setSelected(new Set());
          }}
          options={[
            { value: "all", label: "All" },
            { value: "views", label: "Views" },
            { value: "shares", label: "Shares" },
            { value: "comments", label: "Comments" },
            { value: "saves", label: "Saves" },
            { value: "none", label: "None set" },
          ]}
          className="w-[calc(50%-4px)] flex-none md:w-[130px]"
        />
        <TypeFilter
          types={typeList}
          onTypesChange={setTypeList}
          value={typeFilter}
          onChange={(v) => {
            setTypeFilter(v);
            setPage(1);
            setSelected(new Set());
          }}
          className="w-[calc(50%-4px)] flex-none md:w-[170px]"
        />
        <Dropdown
          prefix="Posted"
          value={postedRange}
          onChange={(v) => {
            setPostedRange(v as RangeKey);
            setPage(1);
            setSelected(new Set());
          }}
          options={[
            { value: "all", label: "Any date" },
            { value: "7", label: "Last 7 days" },
            { value: "14", label: "Last 14 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
            { value: "custom", label: "Custom" },
          ]}
          className="w-[calc(50%-4px)] flex-none md:w-[190px]"
        />
        <Dropdown
          prefix="Analyzed"
          value={analyzedRange}
          onChange={(v) => {
            setAnalyzedRange(v as RangeKey);
            setPage(1);
            setSelected(new Set());
          }}
          options={[
            { value: "all", label: "Any date" },
            { value: "7", label: "Last 7 days" },
            { value: "14", label: "Last 14 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
            { value: "custom", label: "Custom" },
          ]}
          className="w-[calc(50%-4px)] flex-none md:w-[200px]"
        />
        <button
          type="button"
          onClick={handleTranscribe}
          disabled={isTranscribing}
          className="flex h-9 items-center gap-1.5 rounded-md bg-[#FF1F8F] px-3.5 text-[12.5px] font-extrabold whitespace-nowrap text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60 md:ml-auto"
        >
          <MaterialIcon name="graphic_eq" size={17} weight={500} />
          {isTranscribing ? "Sending…" : `Transcribe (${selected.size})`}
        </button>
        {(postedRange === "custom" || analyzedRange === "custom") && (
          <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] font-semibold text-[#4a4a48]">
            {postedRange === "custom" && (
              <span className="flex items-center gap-1.5">
                Posted
                <input type="date" value={postedFrom} onChange={(e) => { setPostedFrom(e.target.value); setPage(1); setSelected(new Set()); }} className="h-8 rounded-md border border-[#E4E4E2] bg-white px-2 text-[12.5px] font-semibold text-[#0D0D0D] outline-none" />
                to
                <input type="date" value={postedTo} onChange={(e) => { setPostedTo(e.target.value); setPage(1); setSelected(new Set()); }} className="h-8 rounded-md border border-[#E4E4E2] bg-white px-2 text-[12.5px] font-semibold text-[#0D0D0D] outline-none" />
              </span>
            )}
            {analyzedRange === "custom" && (
              <span className="flex items-center gap-1.5">
                Analyzed
                <input type="date" value={analyzedFrom} onChange={(e) => { setAnalyzedFrom(e.target.value); setPage(1); setSelected(new Set()); }} className="h-8 rounded-md border border-[#E4E4E2] bg-white px-2 text-[12.5px] font-semibold text-[#0D0D0D] outline-none" />
                to
                <input type="date" value={analyzedTo} onChange={(e) => { setAnalyzedTo(e.target.value); setPage(1); setSelected(new Set()); }} className="h-8 rounded-md border border-[#E4E4E2] bg-white px-2 text-[12.5px] font-semibold text-[#0D0D0D] outline-none" />
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 px-3 pb-1 text-[13px] font-semibold md:-mt-2 md:h-9 md:flex-nowrap md:px-6 md:pb-0">
        {selected.size > 0 && (
            <div className="flex items-center gap-1">
              <span className="mr-2 font-extrabold">{selected.size} selected</span>
              {isRepulling && (
                <span className="mr-2 flex items-center gap-1.5 rounded-full bg-[#FFD9EB] px-2.5 py-1 text-xs font-bold whitespace-nowrap text-[#FF1F8F]">
                  <EqualizerIcon size={13} />
                  Re-pulling {selected.size} {selected.size === 1 ? "reel" : "reels"}… this can take a minute
                </span>
              )}
              <IconAction
                icon={<AddToBoardIcon />}
                label="Add to board"
                onClick={() => {
                  setPickedBoards(new Set());
                  setDialog("board");
                }}
              />
              <IconAction
                icon="sell"
                label="Tag content type"
                onClick={() => {
                  setTagPick(new Set());
                  setDialog("tag");
                }}
              />
              <IconAction icon="auto_awesome" label="Auto-suggest tags" onClick={() => setSuggestOpen(true)} />
              <IconAction
                icon={<GoalIcon />}
                label="Set goal"
                onClick={() => {
                  setPickedGoals(new Set());
                  setDialog("goal");
                }}
              />
              <IconAction
                icon="favorite"
                filled={allSelectedFavorited}
                label={allSelectedFavorited ? "Remove from Favorites" : "Favorite"}
                onClick={() => {
                  toggleFavorite([...selected], !allSelectedFavorited);
                  setSelected(new Set());
                }}
              />
              <IconAction
                icon={isRepulling ? <EqualizerIcon size={16} /> : "refresh"}
                label={isRepulling ? "Re-pulling…" : "Re-pull (fresh stats)"}
                disabled={isRepulling}
                onClick={handleRepull}
              />
              <IconAction icon="delete" label="Delete" onClick={() => handleDelete([...selected])} />
              <IconAction icon="deselect" label="Clear selection" onClick={() => setSelected(new Set())} />
            </div>
        )}
        {selected.size > 0 && pageAllSelected && filtered.length > pageRows.length && (
          <div className="flex items-center gap-2 text-[#4a4a48]">
            <span>
              {allMatchingSelected
                ? `All ${filtered.length} matching reels selected.`
                : `All ${pageRows.length} on this page selected.`}
            </span>
            <button
              type="button"
              onClick={selectAllMatching}
              className="font-extrabold text-[#0D0D0D] underline decoration-2 underline-offset-[3px] hover:text-[#FF1F8F]"
            >
              {allMatchingSelected ? "Clear selection" : `Select all ${filtered.length} matching`}
            </button>
          </div>
        )}
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="ml-auto font-bold text-[#FF1F8F] hover:text-[#0D0D0D]">
            Clear filters
          </button>
        )}
      </div>

      <div className="border-t border-[#F0F0F1] md:hidden">
        <div className="flex items-center gap-2.5 border-b border-[#F0F0F1] bg-[#FBFBFA] px-3 py-2 text-xs font-bold text-[#4a4a48]">
          <button type="button" onClick={togglePage} aria-label="Select all on page" className="flex items-center gap-2.5">
            <span
              className="flex size-4 items-center justify-center rounded-[3px] border-[1.5px]"
              style={{
                background: pageAllSelected || pageSomeSelected ? "#0D0D0D" : "#FFFFFF",
                borderColor: pageAllSelected || pageSomeSelected ? "#0D0D0D" : "#BDBDBB",
              }}
            >
              {(pageAllSelected || pageSomeSelected) && (
                <MaterialIcon name={pageAllSelected ? "check" : "remove"} size={12} className="text-white" />
              )}
            </span>
            Select all
          </button>
        </div>
        {pageRows.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-[13px] font-medium text-[#4a4a48]">
            <MaterialIcon name="search_off" size={26} />
            No reels match these filters.
            <button type="button" onClick={clearFilters} className="font-extrabold text-[#0D0D0D] underline decoration-2 underline-offset-[3px]">
              Clear filters
            </button>
          </div>
        )}
        {pageRows.map((r) => {
          const on = selected.has(r.id);
          const ts = tsMetaFor(r);
          const goal = goalOf(r);
          return (
            <div
              key={r.id}
              className="flex items-start gap-2.5 border-b border-[#F0F0F1] px-3 py-2.5"
              style={{ background: on ? "#F0F0F1" : "#FFFFFF" }}
            >
              <button type="button" onClick={() => toggleRow(r.id)} aria-label="Select reel" className="mt-1 flex-none">
                <span
                  className="flex size-4 items-center justify-center rounded-[3px] border-[1.5px]"
                  style={{ background: on ? "#0D0D0D" : "#FFFFFF", borderColor: on ? "#0D0D0D" : "#BDBDBB" }}
                >
                  {on && <MaterialIcon name="check" size={12} className="text-white" />}
                </span>
              </button>
              <Link href={`/analyze-reel/reel/${r.id}`} prefetch={false} className="flex-none">
                <ReelThumb url={r.thumbnailUrl} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link
                  href={`/analyze-reel/reel/${r.id}`}
                  prefetch={false}
                  className="line-clamp-2 text-[13px] leading-[1.3] font-semibold text-[#0D0D0D]"
                >
                  {r.caption || "(no caption)"}
                </Link>
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] font-semibold text-[#4a4a48]">
                  {r.ownerUsername ? (
                    <a href={`https://www.instagram.com/${r.ownerUsername}/`} target="_blank" rel="noopener noreferrer" className="truncate">
                      @{r.ownerUsername}
                    </a>
                  ) : (
                    <span>—</span>
                  )}
                  <OutlierBadge value={r.outlier[outMetric]} metric={outMetric} />
                  {typesCell(r)}
                  {favs.has(r.id) && (
                    <span className="msym flex-none select-none text-[#FF1F8F]" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                      favorite
                    </span>
                  )}
                  {r.boardNames.length > 0 && (
                    <span title={`In: ${r.boardNames.join(", ")}`} className="flex flex-none items-center text-[#4a4a48]">
                      <MaterialIcon name="folder" size={14} />
                    </span>
                  )}
                  <span className="text-[#BDBDBB]">·</span>
                  <span className="whitespace-nowrap">{fmtShortDate(r.postedAt)}</span>
                  {repullIds.has(r.id) && (
                    <span className="flex flex-none items-center gap-1 rounded-full bg-[#FFD9EB] px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap text-[#FF1F8F]">
                      <EqualizerIcon size={11} />
                      Re-pulling
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-x-1 gap-y-1.5 pr-1 text-[11px] leading-none">
                  {(
                    [
                      ["visibility", fmtN(r.views)],
                      ["favorite", fmtN(r.likes)],
                      ["comment", fmtN(r.commentsCount)],
                      ["send", r.sharesCount == null ? "—" : fmtN(r.sharesCount)],
["repeat", r.repostsCount == null ? "—" : fmtN(r.repostsCount)],
["bookmark", r.savesCount == null ? "—" : fmtN(r.savesCount)],
                      ["av_timer", fmtLen(r.durationSeconds)],
                    ] as const
                  ).map(([icon, value]) => (
                    <span key={icon} className="flex min-w-0 items-center gap-0.5">
                      <MaterialIcon name={icon} size={12} className="text-[#4a4a48]" />
                      <span className="truncate">{value}</span>
                    </span>
                  ))}
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span
                    title={ts.label}
                    className="flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-bold"
                    style={{ background: ts.bg, color: ts.fg }}
                  >
                    {r.transcriptionStatus === "processing" ? <EqualizerIcon size={12} /> : <MaterialIcon name={ts.icon} size={14} weight={500} />}
                    {ts.label}
                  </span>
                  <GoalPicker small goals={goal} onChange={(next) => handleGoalChange(r.id, next)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={tableRef} className="max-h-[70vh] overflow-auto border-t border-[#F0F0F1] max-md:hidden">
        <div style={{ minWidth: `${postWidth + 1150}px` }}>
          <div
            className="sticky top-0 z-10 grid items-center gap-4 border-b border-[#F0F0F1] bg-[#FBFBFA] px-6 py-2.5 text-xs font-bold text-[#4a4a48]"
            style={{ gridTemplateColumns: gridCols(postWidth) }}
          >
            <button type="button" onClick={togglePage} aria-label="Select all on page">
              <span
                className="flex size-4 items-center justify-center rounded-[3px] border-[1.5px]"
                style={{
                  background: pageAllSelected || pageSomeSelected ? "#0D0D0D" : "#FFFFFF",
                  borderColor: pageAllSelected || pageSomeSelected ? "#0D0D0D" : "#BDBDBB",
                }}
              >
                {(pageAllSelected || pageSomeSelected) && (
                  <MaterialIcon name={pageAllSelected ? "check" : "remove"} size={12} className="text-white" />
                )}
              </span>
            </button>
            <span style={{ gridColumn: "span 3" }} className="relative flex items-center">
              Post
              <span
                onMouseDown={startPostDrag}
                title="Drag to resize"
                className="absolute -top-2.5 -right-2 -bottom-2.5 flex w-[11px] cursor-col-resize justify-center hover:bg-[#FFE3F0]"
              >
                <span className="h-[26px] w-px self-center bg-[#D4D4D2]" />
              </span>
            </span>
            {sortCols.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => handleSort(c.key)}
                title={c.tip ?? c.label}
                aria-label={c.tip ?? c.label}
                className={`flex items-center justify-center justify-self-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F] ${sortKey === c.key ? "text-[#0D0D0D]" : ""}`}
              >
                {c.icon ? (
                  <>
                    <MaterialIcon name={c.icon} size={17} />
                    {c.pct && <span className="-ml-0.5 text-[11px] font-extrabold">%</span>}
                  </>
                ) : (
                  c.label
                )}{" "}
                <MaterialIcon name={arrowFor(c.key)} size={15} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleSort("transcript")}
              title="Transcript"
              aria-label="Transcript"
              className={`flex items-center justify-center justify-self-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F] ${sortKey === "transcript" ? "text-[#0D0D0D]" : ""}`}
            >
              <MaterialIcon name="graphic_eq" size={17} /> <MaterialIcon name={arrowFor("transcript")} size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleSort("goal")}
              title="Goal"
              aria-label="Goal"
              className={`flex items-center justify-center justify-self-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F] ${sortKey === "goal" ? "text-[#0D0D0D]" : ""}`}
            >
              <MaterialIcon name="target" size={17} /> <MaterialIcon name={arrowFor("goal")} size={15} />
            </button>
          </div>

          {pageRows.length === 0 && (
            <div className="flex flex-col items-center gap-2.5 px-6 py-14 text-sm font-medium text-[#4a4a48]">
              <MaterialIcon name="search_off" size={28} />
              No reels match these filters.
              <button
                type="button"
                onClick={clearFilters}
                className="font-extrabold text-[#0D0D0D] underline decoration-2 underline-offset-[3px] hover:text-[#FF1F8F]"
              >
                Clear filters
              </button>
            </div>
          )}

          {pageRows.map((r) => {
            const on = selected.has(r.id);
            const isHover = hover === r.id;
            const ts = tsMetaFor(r);
            const goal = goalOf(r);
            const commentRate = r.views > 0 ? r.commentsCount / r.views : 0;
            const repostRate = r.views > 0 && r.repostsCount != null ? r.repostsCount / r.views : null;
            return (
              <div
                key={r.id}
                draggable
                onDragStart={(e) => startReelDrag(e, r.id)}
                onMouseEnter={() => setHover(r.id)}
                onMouseLeave={() => setHover((h) => (h === r.id ? null : h))}
                className="relative grid items-center gap-4 border-b border-[#F0F0F1] px-6 py-2 text-[13px] font-normal text-[#0D0D0D] [font-variant-numeric:tabular-nums]"
                style={{ gridTemplateColumns: gridCols(postWidth), background: on ? "#F0F0F1" : isHover ? "#FBFBFA" : "#FFFFFF" }}
              >
                <button type="button" onClick={() => toggleRow(r.id)} aria-label="Select reel">
                  <span
                    className="flex size-4 items-center justify-center rounded-[3px] border-[1.5px]"
                    style={{ background: on ? "#0D0D0D" : "#FFFFFF", borderColor: on ? "#0D0D0D" : "#BDBDBB" }}
                  >
                    {on && <MaterialIcon name="check" size={12} className="text-white" />}
                  </span>
                </button>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on Instagram"
                  className="flex items-center justify-center"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF1F8F" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1.2" fill="#FF1F8F" stroke="none" />
                  </svg>
                </a>
                <ReelThumb url={r.thumbnailUrl} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={`/analyze-reel/reel/${r.id}`}
                    prefetch={false}
                    className="truncate text-sm font-medium text-[#0D0D0D] hover:text-[#FF1F8F] hover:underline"
                  >
                    {r.caption || "(no caption)"}
                  </Link>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                    {r.ownerUsername ? (
                      <a
                        href={`https://www.instagram.com/${r.ownerUsername}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-xs font-semibold text-[#4a4a48] hover:text-[#FF1F8F] hover:underline"
                      >
                        @{r.ownerUsername}
                      </a>
                    ) : (
                      <span className="truncate text-xs font-semibold text-[#4a4a48]">—</span>
                    )}
                    <OutlierBadge value={r.outlier[outMetric]} metric={outMetric} />
                    {typesCell(r)}
                    {r.boardNames.length > 0 && (
                      <span title={`In: ${r.boardNames.join(", ")}`} className="flex flex-none items-center text-[#4a4a48]">
                        <MaterialIcon name="folder" size={15} />
                      </span>
                    )}
                    {favs.has(r.id) && (
                      <span
                        title="In Favorites"
                        className="msym flex-none select-none text-[#FF1F8F]"
                        style={{ fontSize: 14, fontVariationSettings: "'FILL' 1, 'wght' 400" }}
                      >
                        favorite
                      </span>
                    )}
                  </div>
                </div>
                <span className="justify-self-center text-center whitespace-nowrap">{fmtShortDate(r.postedAt)}</span>
                {repullIds.has(r.id) ? (
                  <span className="flex items-center justify-center gap-1 justify-self-center rounded-full bg-[#FFD9EB] px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-[#FF1F8F]">
                    <EqualizerIcon size={12} />
                    Re-pulling
                  </span>
                ) : (
                  <span className="justify-self-center text-center whitespace-nowrap">{fmtShortDate(r.analyzedAt)}</span>
                )}
                <span className="justify-self-center text-center">{fmtLen(r.durationSeconds)}</span>
                <span className="justify-self-center text-center">{fmtN(r.views)}</span>
                <span className="justify-self-center text-center">{fmtN(r.likes)}</span>
                <span className="justify-self-center text-center">{fmtN(r.commentsCount)}</span>
                <span
                  title={r.sharesCount == null ? "Instagram hides shares on this reel" : ""}
                  className="justify-self-center text-center"
                  style={{ color: r.sharesCount == null ? "#9a9a98" : "#0D0D0D" }}
                >
                  {r.sharesCount == null ? "—" : fmtN(r.sharesCount)}
                </span>
                <span className="justify-self-center text-center" style={{ color: r.repostsCount == null ? "#9a9a98" : "#0D0D0D" }}>
                  {r.repostsCount == null ? "—" : fmtN(r.repostsCount)}
                </span>
                <span className="justify-self-center text-center" style={{ color: r.savesCount == null ? "#9a9a98" : "#0D0D0D" }}>
                  {r.savesCount == null ? "—" : fmtN(r.savesCount)}
                </span>
                <span className="justify-self-center text-center font-semibold" title="Engagement rate (comments ÷ views)">
                  {pct(commentRate)}
                </span>
                <span
                  className="justify-self-center text-center font-semibold"
                  title="Share rate (reposts ÷ views)"
                  style={{ color: repostRate == null ? "#9a9a98" : "#0D0D0D" }}
                >
                  {repostRate == null ? "—" : pct(repostRate)}
                </span>
                <span
                  title={ts.label}
                  className="flex size-7 items-center justify-center justify-self-center rounded-full"
                  style={{ background: ts.bg, color: ts.fg }}
                >
                  {r.transcriptionStatus === "processing" ? (
                    <EqualizerIcon size={15} />
                  ) : (
                    <MaterialIcon name={ts.icon} size={17} weight={500} />
                  )}
                </span>
                <div className="justify-self-center">
                  <GoalPicker compact goals={goal} onChange={(next) => handleGoalChange(r.id, next)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-3 md:gap-3.5 md:px-6">
        <div className="flex items-center gap-2.5 text-[12.5px] font-semibold text-[#4a4a48]">
          <span>{rangeText}</span>
          <span className="text-[#D4D4D2]">|</span>
          <span>Rows</span>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
            className="rounded border border-[#E4E4E2] bg-white px-1 py-0.5 text-[12.5px] font-bold text-[#0D0D0D] outline-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => currentPage > 1 && setPage(currentPage - 1)}
            className="flex size-8 items-center justify-center rounded hover:bg-[#F0F0F1]"
            style={{ opacity: currentPage > 1 ? 1 : 0.3 }}
          >
            <MaterialIcon name="chevron_left" size={20} />
          </button>
          {pageButtons.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className="flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-[13px] font-bold hover:shadow-[inset_0_0_0_1px_#0D0D0D]"
              style={{ background: p === currentPage ? "#0D0D0D" : "transparent", color: p === currentPage ? "#FBFBFA" : "#0D0D0D" }}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => currentPage < pageCount && setPage(currentPage + 1)}
            className="flex size-8 items-center justify-center rounded hover:bg-[#F0F0F1]"
            style={{ opacity: currentPage < pageCount ? 1 : 0.3 }}
          >
            <MaterialIcon name="chevron_right" size={20} />
          </button>
        </div>
      </div>
      <span className="px-3 pb-4 text-xs font-medium text-[#4a4a48] md:px-6 md:pb-5">
        &quot;—&quot; means Instagram doesn&apos;t show shares for that reel. Creator names open their Instagram
        profile.
      </span>

      {dialog === "board" && (
        <ActionDialog
          title={`Add ${selected.size} ${selected.size === 1 ? "reel" : "reels"} to a board`}
          onClose={() => setDialog(null)}
          confirmLabel="Add"
          confirmDisabled={pickedBoards.size === 0}
          onConfirm={() => {
            addToBoards([...pickedBoards], [...selected]);
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
          <div className="px-6 pt-2 pb-1 text-xs font-semibold text-[#4a4a48]">
            Pick one or more boards. Reels stay in Library.
          </div>
        </ActionDialog>
      )}

      {namingBoard && (
        <NameDialog title="Create board" confirmLabel="Create" onClose={() => setNamingBoard(false)} onSubmit={handleNewBoard} />
      )}

      {dialog === "tag" && (
        <ActionDialog
          title={`Tag ${selected.size} ${selected.size === 1 ? "reel" : "reels"}`}
          onClose={() => setDialog(null)}
          confirmLabel="Add tags"
          confirmDisabled={tagPick.size === 0}
          onConfirm={() => {
            addTypesTo([...selected], [...tagPick]);
            flash(`Tagged ${selected.size} ${selected.size === 1 ? "reel" : "reels"}`);
            setSelected(new Set());
            setDialog(null);
          }}
        >
          {typeList.length === 0 && <span className="px-6 py-4 text-sm font-medium text-[#4a4a48]">No tags yet. Open a reel's tag box to create one.</span>}
          {typeList.map((t) => {
            const on = tagPick.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setTagPick((prev) => {
                    const next = new Set(prev);
                    if (next.has(t.id)) next.delete(t.id);
                    else next.add(t.id);
                    return next;
                  })
                }
                className="flex items-center gap-3 px-6 py-2.5 text-left hover:bg-[#F6F6F5]"
              >
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
          reels={rows.filter((r) => selected.has(r.id)).map((r) => ({ id: r.id, caption: r.caption, thumbnailUrl: r.thumbnailUrl }))}
          types={typeList}
          onTypesChange={setTypeList}
          onClose={() => setSuggestOpen(false)}
          onApply={(picks) => {
            const byType = new Map<string, string[]>();
            for (const [rid, tids] of Object.entries(picks)) for (const tid of tids) byType.set(tid, [...(byType.get(tid) ?? []), rid]);
            for (const [tid, rids] of byType) addTypesTo(rids, [tid]);
            flash(`Tagged ${Object.keys(picks).length} ${Object.keys(picks).length === 1 ? "reel" : "reels"}`);
            setSuggestOpen(false);
            setSelected(new Set());
          }}
        />
      )}

      {dialog === "goal" && (
        <ActionDialog
          title={`Set goal for ${selected.size} ${selected.size === 1 ? "reel" : "reels"}`}
          onClose={() => setDialog(null)}
          confirmLabel="Set goal"
          confirmDisabled={pickedGoals.size === 0}
          onConfirm={() => {
            handleBulkGoal([...pickedGoals]);
            setDialog(null);
          }}
        >
          {GOAL_OPTIONS.map((g) => (
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
        <div className="fixed bottom-7 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3.5 rounded-md bg-[#0D0D0D] px-4.5 py-3 text-sm font-bold text-[#FBFBFA]">
          <span className="size-2 rounded-full bg-[#C6FF3D]" />
          <span>{toast.message}</span>
          {toast.undoIds && (
            <button type="button" onClick={undoDelete} className="font-extrabold text-[#E6FF00] underline decoration-2 underline-offset-[3px]">
              Undo
            </button>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

// Pick one or more goals for a reel. Opens a small checklist under the button.
function GoalPicker({ goals, onChange, small, compact }: { goals: ReelGoal[]; onChange: (next: ReelGoal[]) => void; small?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 196)) });
    setOpen(true);
  }

  const label = goals.length ? goals.map((g) => GOAL_OPTIONS.find((o) => o.value === g)?.label).join(" + ") : "Set goal";
  const has = goals.length > 0;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        title={has ? `Goal: ${label}` : "Set goal"}
        aria-label={has ? `Goal: ${label}` : "Set goal"}
        className={`flex items-center gap-1 rounded-full border font-bold whitespace-nowrap ${
          compact ? "h-7 min-w-7 justify-center px-1.5" : small ? "h-6 pr-1.5 pl-2.5 text-[11px]" : "h-7 pr-2 pl-3 text-[12.5px]"
        }`}
        style={{
          borderColor: has ? "#FFE3F0" : "#E4E4E2",
          background: has ? "#FFE3F0" : "#FFFFFF",
          color: has ? "#FF1F8F" : "#6b6b69",
        }}
      >
        {compact ? (
          has ? (
            goals.map((g) => <MaterialIcon key={g} name={GOAL_OPTIONS.find((o) => o.value === g)?.icon ?? "target"} size={15} />)
          ) : (
            <MaterialIcon name="target" size={15} />
          )
        ) : (
          <span className="max-w-[130px] truncate">{label}</span>
        )}
        {!compact && <MaterialIcon name="expand_more" size={small ? 14 : 16} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[56] flex w-[188px] flex-col rounded-lg border border-[#F0F0F1] bg-white p-1.5 shadow-[0_12px_32px_rgba(13,13,13,0.16)]"
            style={{ top: pos.top, left: pos.left }}
          >
            {GOAL_OPTIONS.map((o) => {
              const on = goals.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onChange(on ? goals.filter((g) => g !== o.value) : [...goals, o.value])}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] font-semibold text-[#0D0D0D] hover:bg-[#F6F6F5]"
                  style={{ background: on ? "#F0F0F1" : undefined }}
                >
                  <MaterialIcon name={o.icon} size={17} />
                  <span className="flex-1">{o.label}</span>
                  {on && <MaterialIcon name="check" size={17} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
