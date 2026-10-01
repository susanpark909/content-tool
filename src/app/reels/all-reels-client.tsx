"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelThumb } from "@/components/reel-thumb";
import { useColumnWidth } from "@/lib/use-column-width";
import { deleteReels, repullReels, setReelGoal, setReelGoalBulk, type ReelGoal } from "./actions";
import { transcribeSelectedReels } from "@/app/research/[batchId]/actions";

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
  durationSeconds: number | null;
  transcriptionStatus: string | null;
  goal: ReelGoal | null;
  isSingle: boolean;
};

const GOAL_OPTIONS: { value: ReelGoal; label: string; icon: string }[] = [
  { value: "views", label: "Views", icon: "visibility" },
  { value: "shares", label: "Shares", icon: "send" },
  { value: "comments", label: "Comments", icon: "chat_bubble" },
];

type SortKey =
  | "postedAt"
  | "analyzedAt"
  | "durationSeconds"
  | "views"
  | "likes"
  | "commentsCount"
  | "sharesCount"
  | "transcript"
  | "goal";
type RangeKey = "all" | "7" | "14" | "30" | "90" | "custom";
type TstatKey = "all" | "done" | "not";
type SourceKey = "all" | "profile" | "single";

function gridCols(postWidth: number) {
  return `22px 20px 34px minmax(${postWidth}px,1fr) 66px 66px 46px 56px 56px 100px 96px 76px 92px 24px`;
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

const TS_META: Record<string, { label: string; bg: string; fg: string; icon: string; rank: number }> = {
  ready: { label: "Transcribed", bg: "#C6FF3D", fg: "#0D0D0D", icon: "check", rank: 2 },
  processing: { label: "Transcribing", bg: "#FFD9EB", fg: "#FF1F8F", icon: "graphic_eq", rank: 1 },
  error: { label: "Transcription error", bg: "#FFD9D9", fg: "#D10A6E", icon: "priority_high", rank: 1 },
};
const TS_NONE = { label: "Not transcribed yet", bg: "#F0F0F1", fg: "#9a9a98", icon: "remove", rank: 0 };

function tsMeta(status: string | null) {
  return (status && TS_META[status]) || TS_NONE;
}

export function AllReelsClient({ rows }: { rows: AllReelsRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceKey>("all");
  const [creator, setCreator] = useState("all");
  const [range, setRange] = useState<RangeKey>("all");
  const [dateFrom, setDateFrom] = useState(isoDaysAgo(30));
  const [dateTo, setDateTo] = useState(isoDaysAgo(0));
  const [tstat, setTstat] = useState<TstatKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("postedAt");
  const [direction, setDirection] = useState<1 | -1>(-1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [goals, setGoals] = useState<Record<string, ReelGoal | null>>({});
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [toast, setToast] = useState<{ message: string; undoIds?: string[] } | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRepulling, setIsRepulling] = useState(false);
  const { width: postWidth, startDrag: startPostDrag } = useColumnWidth("rc-allreels-post-w", 260, 160, 640);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function flash(message: string, undoIds?: string[]) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, undoIds });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  function goalOf(row: AllReelsRow) {
    return goals[row.id] !== undefined ? goals[row.id] : row.goal;
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

  function handleGoalChange(id: string, goal: ReelGoal | null) {
    setGoals((prev) => ({ ...prev, [id]: goal }));
    setReelGoal(id, goal).catch(() => {});
  }

  function handleBulkGoal(goal: ReelGoal, label: string) {
    const ids = [...selected];
    if (ids.length === 0) return;
    setGoals((prev) => {
      const next = { ...prev };
      ids.forEach((id) => (next[id] = goal));
      return next;
    });
    setReelGoalBulk(ids, goal).catch(() => {});
    flash(`Goal set to ${label} on ${ids.length} ${ids.length === 1 ? "reel" : "reels"}`);
  }

  function handleTranscribe() {
    const ids = [...selected];
    if (ids.length === 0) {
      flash("Select reels to transcribe");
      return;
    }
    setIsTranscribing(true);
    transcribeSelectedReels(ids)
      .then(() => flash(`${ids.length} ${ids.length === 1 ? "reel" : "reels"} sent to transcription`))
      .catch(() => flash("Something went wrong sending to transcription"))
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
      .finally(() => setIsRepulling(false));
    setSelected(new Set());
  }

  const live = useMemo(() => rows.filter((r) => !deleted.has(r.id)), [rows, deleted]);

  const creators = useMemo(
    () =>
      Array.from(new Set(live.map((r) => r.ownerUsername).filter((u): u is string => Boolean(u)))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [live],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let minTs = -Infinity;
    let maxTs = Infinity;
    if (range === "custom") {
      minTs = new Date(dateFrom + "T00:00:00").getTime();
      maxTs = new Date(dateTo + "T23:59:59").getTime();
    } else if (range !== "all") {
      const d = new Date();
      d.setDate(d.getDate() - Number(range));
      minTs = d.getTime();
    }
    return live.filter((r) => {
      if (source === "single" && !r.isSingle) return false;
      if (source === "profile" && r.isSingle) return false;
      if (creator !== "all" && r.ownerUsername !== creator) return false;
      const ts = r.postedAt ? new Date(r.postedAt).getTime() : 0;
      if (ts < minTs || ts > maxTs) return false;
      const done = r.transcriptionStatus === "ready";
      if (tstat === "done" && !done) return false;
      if (tstat === "not" && done) return false;
      if (q) {
        const hit = (r.caption ?? "").toLowerCase().includes(q) || (r.ownerUsername ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [live, query, source, creator, range, dateFrom, dateTo, tstat]);

  const sorted = useMemo(() => {
    const val = (r: AllReelsRow): number => {
      if (sortKey === "postedAt") return r.postedAt ? new Date(r.postedAt).getTime() : 0;
      if (sortKey === "analyzedAt") return new Date(r.analyzedAt).getTime();
      if (sortKey === "durationSeconds") return r.durationSeconds ?? -Infinity;
      if (sortKey === "transcript") return tsMeta(r.transcriptionStatus).rank;
      if (sortKey === "goal") return ({ null: 0, views: 1, shares: 2, comments: 3 } as Record<string, number>)[goalOf(r) ?? "null"];
      if (sortKey === "sharesCount") return r.sharesCount ?? -Infinity;
      return r[sortKey] as number;
    };
    return [...filtered].sort((a, b) => (val(a) - val(b)) * direction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, direction, goals]);

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

  const hasFilters = !!query || source !== "all" || creator !== "all" || range !== "all" || tstat !== "all";
  function clearFilters() {
    setQuery("");
    setSource("all");
    setCreator("all");
    setRange("all");
    setTstat("all");
    setPage(1);
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

  const sortCols: { label: string; key: SortKey }[] = [
    { label: "Posted", key: "postedAt" },
    { label: "Analyzed", key: "analyzedAt" },
    { label: "Length", key: "durationSeconds" },
    { label: "Views", key: "views" },
    { label: "Likes", key: "likes" },
    { label: "Comments", key: "commentsCount" },
    { label: "Shares", key: "sharesCount" },
  ];

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
      <div className="flex flex-wrap items-end gap-3 px-6 py-5">
        <div className="flex h-[42px] min-w-[220px] flex-1 basis-[280px] items-center gap-2.5 rounded-md border border-[#E4E4E2] px-3 focus-within:border-[#0D0D0D]">
          <MaterialIcon name="search" size={20} className="text-[#4a4a48]" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search reels, creators, captions…"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-[#0D0D0D] outline-none"
          />
        </div>

        <div className="flex w-40 flex-none flex-col gap-1.5">
          <span className="text-xs font-bold text-[#4a4a48]">Creator</span>
          <div className="relative">
            <select
              value={creator}
              onChange={(e) => {
                setCreator(e.target.value);
                setPage(1);
              }}
              className="h-[42px] w-full appearance-none rounded-md border border-[#E4E4E2] bg-white px-3 pr-8 text-[13.5px] font-semibold text-[#0D0D0D] outline-none"
            >
              <option value="all">All creators</option>
              {creators.map((c) => (
                <option key={c} value={c}>
                  @{c}
                </option>
              ))}
            </select>
            <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-3 right-2.5 text-[#4a4a48]" />
          </div>
        </div>

        <div className="flex w-[150px] flex-none flex-col gap-1.5">
          <span className="text-xs font-bold text-[#4a4a48]">Date range</span>
          <div className="relative">
            <select
              value={range}
              onChange={(e) => {
                setRange(e.target.value as RangeKey);
                setPage(1);
              }}
              className="h-[42px] w-full appearance-none rounded-md border border-[#E4E4E2] bg-white px-3 pr-8 text-[13.5px] font-semibold text-[#0D0D0D] outline-none"
            >
              <option value="all">Any date</option>
              <option value="7">Last 7 days</option>
              <option value="14">Last 2 weeks</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="custom">Custom</option>
            </select>
            <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-3 right-2.5 text-[#4a4a48]" />
          </div>
        </div>

        <div className="flex w-40 flex-none flex-col gap-1.5">
          <span className="text-xs font-bold text-[#4a4a48]">Transcription status</span>
          <div className="relative">
            <select
              value={tstat}
              onChange={(e) => {
                setTstat(e.target.value as TstatKey);
                setPage(1);
              }}
              className="h-[42px] w-full appearance-none rounded-md border border-[#E4E4E2] bg-white px-3 pr-8 text-[13.5px] font-semibold text-[#0D0D0D] outline-none"
            >
              <option value="all">All reels</option>
              <option value="done">Transcribed</option>
              <option value="not">Not yet</option>
            </select>
            <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-3 right-2.5 text-[#4a4a48]" />
          </div>
        </div>

        <div className="flex w-[150px] flex-none flex-col gap-1.5">
          <span className="text-xs font-bold text-[#4a4a48]">Source</span>
          <div className="relative">
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value as SourceKey);
                setPage(1);
              }}
              className="h-[42px] w-full appearance-none rounded-md border border-[#E4E4E2] bg-white px-3 pr-8 text-[13.5px] font-semibold text-[#0D0D0D] outline-none"
            >
              <option value="all">All sources</option>
              <option value="profile">Profile pulls</option>
              <option value="single">Single reels</option>
            </select>
            <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-3 right-2.5 text-[#4a4a48]" />
          </div>
        </div>

        <button
          type="button"
          onClick={handleTranscribe}
          disabled={isTranscribing}
          className="flex h-[42px] items-center gap-2 rounded-md bg-[#FF1F8F] px-4.5 text-sm font-extrabold whitespace-nowrap text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60"
        >
          <MaterialIcon name="graphic_eq" size={19} weight={500} />
          {isTranscribing ? "Sending…" : `Transcribe (${selected.size})`}
        </button>
      </div>

      {range === "custom" && (
        <div className="-mt-1.5 flex items-center gap-2 px-6 pb-4 text-[13px] font-semibold text-[#4a4a48]">
          <span>From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-md border border-[#E4E4E2] bg-white px-2.5 text-[13px] font-semibold text-[#0D0D0D] outline-none"
          />
          <span>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-md border border-[#E4E4E2] bg-white px-2.5 text-[13px] font-semibold text-[#0D0D0D] outline-none"
          />
        </div>
      )}

      {(selected.size > 0 || hasFilters) && (
        <div className="-mt-1 flex items-center gap-3.5 px-6 pb-3.5 text-[13px] font-semibold">
          {selected.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="font-extrabold">{selected.size} selected</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#4a4a48]">Set goal</span>
                {GOAL_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => handleBulkGoal(g.value, g.label)}
                    className="flex h-7 items-center gap-1.5 rounded-full border border-[#E4E4E2] bg-white px-2.5 text-xs font-bold hover:border-[#FF1F8F] hover:text-[#FF1F8F]"
                  >
                    <MaterialIcon name={g.icon} size={15} weight={500} />
                    {g.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleRepull}
                disabled={isRepulling}
                title="Fetch fresh stats, length, and thumbnail from Instagram for the selected reels"
                className="flex items-center gap-1 font-bold hover:text-[#FF1F8F] disabled:opacity-60"
              >
                <MaterialIcon name="refresh" size={17} />
                {isRepulling ? "Re-pulling…" : "Re-pull"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete([...selected])}
                className="flex items-center gap-1 font-bold hover:text-[#FF1F8F]"
              >
                <MaterialIcon name="delete" size={17} />
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-[#4a4a48] hover:text-[#0D0D0D]"
              >
                Clear selection
              </button>
            </div>
          )}
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="font-bold text-[#FF1F8F] hover:text-[#0D0D0D]">
              Clear filters
            </button>
          )}
        </div>
      )}

      {pageAllSelected && filtered.length > pageRows.length && (
        <div className="flex items-center justify-center gap-2 border-t border-[#F0F0F1] bg-[#FFF0F7] px-6 py-2.5 text-[13px] font-semibold">
          <span>
            {allMatchingSelected
              ? `All ${filtered.length} matching reels selected.`
              : `All ${pageRows.length} on this page selected.`}
          </span>
          <button
            type="button"
            onClick={selectAllMatching}
            className="font-extrabold underline decoration-2 underline-offset-[3px] hover:text-[#FF1F8F]"
          >
            {allMatchingSelected ? "Clear selection" : `Select all ${filtered.length} matching`}
          </button>
        </div>
      )}

      <div className="max-h-[70vh] overflow-auto border-t border-[#F0F0F1]">
        <div style={{ minWidth: `${postWidth + 862}px` }}>
          <div
            className="sticky top-0 z-10 grid items-center gap-4 bg-[#FBFBFA] px-6 py-2.5 text-xs font-bold text-[#4a4a48]"
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
                className="absolute top-1/2 right-0 h-4 w-2.5 -translate-y-1/2 cursor-col-resize rounded-sm hover:bg-[#E4E4E2]"
              />
            </span>
            {sortCols.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => handleSort(c.key)}
                className="flex items-center justify-end gap-0.5 whitespace-nowrap hover:text-[#FF1F8F]"
              >
                {c.label} <MaterialIcon name={arrowFor(c.key)} size={16} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleSort("transcript")}
              className="flex items-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F]"
            >
              Transcript <MaterialIcon name={arrowFor("transcript")} size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleSort("goal")}
              className="flex items-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F]"
            >
              Goal <MaterialIcon name={arrowFor("goal")} size={16} />
            </button>
            <span />
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
            const ts = tsMeta(r.transcriptionStatus);
            const goal = goalOf(r);
            const commentRate = r.views > 0 ? r.commentsCount / r.views : 0;
            const shareRate = r.views > 0 && r.sharesCount != null ? r.sharesCount / r.views : null;
            return (
              <div
                key={r.id}
                onMouseEnter={() => setHover(r.id)}
                onMouseLeave={() => setHover((h) => (h === r.id ? null : h))}
                className="grid items-center gap-4 border-b border-[#F0F0F1] px-6 py-2 text-[13.5px] font-semibold [font-variant-numeric:tabular-nums]"
                style={{ gridTemplateColumns: gridCols(postWidth), background: on ? "#FFF0F7" : isHover ? "#FBFBFA" : "#FFFFFF" }}
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
                    href={`/research/reel/${r.id}`}
                    className="truncate text-sm font-medium text-[#0D0D0D] hover:text-[#FF1F8F] hover:underline"
                  >
                    {r.caption || "(no caption)"}
                  </Link>
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
                </div>
                <span className="text-[13px] whitespace-nowrap text-[#4a4a48]">{fmtShortDate(r.postedAt)}</span>
                <span className="text-[13px] whitespace-nowrap text-[#4a4a48]">{fmtShortDate(r.analyzedAt)}</span>
                <span>{fmtLen(r.durationSeconds)}</span>
                <span className="font-bold">{fmtN(r.views)}</span>
                <span>{fmtN(r.likes)}</span>
                <span className="whitespace-nowrap">
                  {fmtN(r.commentsCount)} <span className="font-medium text-[#7a7a78]">({pct(commentRate)})</span>
                </span>
                <span
                  title={r.sharesCount == null ? "Instagram hides shares on this reel" : ""}
                  className="whitespace-nowrap"
                  style={{ color: r.sharesCount == null ? "#9a9a98" : "#0D0D0D" }}
                >
                  {r.sharesCount == null ? "—" : fmtN(r.sharesCount)}{" "}
                  {shareRate != null && <span className="font-medium text-[#7a7a78]">({pct(shareRate)})</span>}
                </span>
                <span
                  title={ts.label}
                  className="ml-2 flex size-7 items-center justify-center justify-self-start rounded-full"
                  style={{ background: ts.bg, color: ts.fg }}
                >
                  <MaterialIcon name={ts.icon} size={17} weight={500} />
                </span>
                <div className="relative justify-self-start">
                  <select
                    value={goal ?? ""}
                    onChange={(e) => handleGoalChange(r.id, (e.target.value || null) as ReelGoal | null)}
                    className="h-7 appearance-none rounded-full border py-0 pr-6.5 pl-3 text-[12.5px] font-bold outline-none"
                    style={{
                      borderColor: goal ? "#FFE3F0" : "#E4E4E2",
                      background: goal ? "#FFE3F0" : "#FFFFFF",
                      color: goal ? "#FF1F8F" : "#6b6b69",
                    }}
                  >
                    <option value="">Set goal</option>
                    <option value="views">Views</option>
                    <option value="shares">Shares</option>
                    <option value="comments">Comments</option>
                  </select>
                  <span
                    className="pointer-events-none absolute top-1.5 right-2"
                    style={{ color: goal ? "#FF1F8F" : "#6b6b69" }}
                  >
                    <MaterialIcon name="expand_more" size={16} />
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete([r.id])}
                  title="Delete reel"
                  className="rounded p-1 text-[#4a4a48] transition-opacity hover:bg-[#F0F0F1] hover:text-[#0D0D0D]"
                  style={{ opacity: isHover ? 1 : 0 }}
                >
                  <MaterialIcon name="close" size={18} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3.5 px-6 py-3">
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
      <span className="px-6 pb-5 text-xs font-medium text-[#4a4a48]">
        &quot;—&quot; means Instagram doesn&apos;t show shares for that reel. Creator names open their Instagram
        profile.
      </span>

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
  );
}
