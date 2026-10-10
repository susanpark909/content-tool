"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExcludeCreators } from "@/components/exclude-creators";
import { OutlierFilter, OutlierBadge } from "@/components/outlier-filter";
import type { Outliers } from "@/lib/creator-typicals";
import type { OutlierGoal } from "@/lib/outlier";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { ReelGoal } from "@/app/reels/actions";
import { removeFromLibrary, useReelInNewIdea } from "./actions";
import { toParagraphs } from "@/lib/transcript-paragraphs";

export type LibraryRow = {
  id: string;
  url: string;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  hookText: string;
  bodyText: string | null;
  ctaText: string | null;
  transcript: string | null;
  caption: string | null;
  postedAt: string | null;
  views: number;
  likes: number;
  commentsCount: number;
  sharesCount: number | null;
  repostsCount: number | null;
  savesCount: number | null;
  goals: ReelGoal[];
  durationSeconds: number | null;
  outlier: Outliers;
};

type Tab = "hooks" | "scripts";
type RangeKey = "all" | "7" | "30" | "90" | "custom";
type SortKey = "views" | "likes" | "comments" | "shares" | "saves" | "reposts" | "engagement" | "date" | "outlier";

const GOAL_LABELS: Record<ReelGoal, string> = { views: "Views", shares: "Shares", comments: "Comments", saves: "Saves" };
const AVATAR_COLORS = ["#FFE3F0", "#EAF8D8", "#E3ECFF", "#F0F0F1", "#FFF3C4"];

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtLen(seconds: number | null) {
  if (seconds == null) return "—";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function avatarColor(username: string | null) {
  if (!username) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initialsOf(username: string | null) {
  return (username ?? "??").slice(0, 2).toUpperCase();
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const STATS_ICONS: {
  key: "views" | "likes" | "commentsCount" | "sharesCount" | "repostsCount" | "savesCount";
  icon: string;
  label: string;
}[] = [
  { key: "views", icon: "visibility", label: "Views" },
  { key: "likes", icon: "favorite", label: "Likes" },
  { key: "commentsCount", icon: "comment", label: "Comments" },
  { key: "sharesCount", icon: "send", label: "Shares" },
  { key: "repostsCount", icon: "repeat", label: "Reposts" },
  { key: "savesCount", icon: "bookmark", label: "Saves" },
];

function Avatar({ row }: { row: LibraryRow }) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      className="flex size-8 flex-none items-center justify-center overflow-hidden rounded-full text-[11.5px] font-bold text-[#0D0D0D]"
      style={{ background: avatarColor(row.ownerUsername) }}
    >
      {row.ownerAvatarUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.ownerAvatarUrl}
          alt=""
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      ) : (
        initialsOf(row.ownerUsername)
      )}
    </span>
  );
}

function StatsRow({ row }: { row: LibraryRow }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] [font-variant-numeric:tabular-nums] max-sm:gap-x-3.5">
      {STATS_ICONS.map((s) => (
        <span key={s.key} className="flex items-center gap-1 font-normal text-[#7a7a78]">
          <MaterialIcon name={s.icon} size={14} className="text-[#9a9a98]" />
          <span className="max-sm:hidden">{s.label}</span>
          <span className="text-[#0D0D0D]">
            {row[s.key] == null ? "—" : fmtN(row[s.key] as number)}
          </span>
        </span>
      ))}
    </div>
  );
}

function RowMenu({
  open,
  onToggle,
  onCopy,
  onUseInIdea,
  onRemove,
  className = "",
}: {
  className?: string;
  open: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onUseInIdea: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        title="More"
        className="flex size-9 items-center justify-center rounded-md text-[#4a4a48] hover:bg-[#F0F0F1] hover:text-[#0D0D0D]"
      >
        <MaterialIcon name="more_vert" size={20} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-[38px] right-0 z-20 flex w-[190px] flex-col rounded-lg border border-[#F0F0F1] bg-white p-1.5 shadow-[0_12px_32px_rgba(13,13,13,0.14)]"
        >
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] font-semibold hover:bg-[#F6F6F5]"
          >
            <MaterialIcon name="copy_all" size={18} />
            Copy text
          </button>
          <button
            type="button"
            onClick={onUseInIdea}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] font-semibold hover:bg-[#F6F6F5]"
          >
            <MaterialIcon name="lightbulb" size={18} />
            Use in new idea
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] font-semibold text-[#D10A6E] hover:bg-[#F6F6F5]"
          >
            <MaterialIcon name="delete" size={18} />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

export function LibraryClient({ rows }: { rows: LibraryRow[] }) {
  const [tab, setTab] = useState<Tab>("hooks");
  const tabLoaded = useRef(false);

  // Coming back from a reel's detail page should land on the same tab.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("rc-library-tab") === "scripts") setTab("scripts");
    } catch {}
    tabLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!tabLoaded.current) return;
    try {
      sessionStorage.setItem("rc-library-tab", tab);
    } catch {}
  }, [tab]);
  const [query, setQuery] = useState("");
  const [creator, setCreator] = useState<string[]>([]);
  const [outMetric, setOutMetric] = useState<OutlierGoal>("views");
  const [outMin, setOutMin] = useState(0);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [goalFilter, setGoalFilter] = useState("all");
  const [range, setRange] = useState<RangeKey>("all");
  const [dateFrom, setDateFrom] = useState(isoDaysAgo(90));
  const [dateTo, setDateTo] = useState(isoDaysAgo(0));
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastHref, setToastHref] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function closeMenu() {
      setMenuId(null);
    }
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  function flash(message: string, href?: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    setToastHref(href ?? null);
    toastTimer.current = setTimeout(() => setToast(null), href ? 6000 : 1800);
  }

  const live = useMemo(() => rows.filter((r) => !removed.has(r.id)), [rows, removed]);
  const scriptRows = useMemo(() => live.filter((r) => r.transcript), [live]);

  const creators = useMemo(
    () => Array.from(new Set(live.map((r) => r.ownerUsername).filter((u): u is string => Boolean(u)))).sort((a, b) => a.localeCompare(b)),
    [live],
  );

  function filterAndSort(list: LibraryRow[]) {
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
    const filtered = list.filter((r) => {
      if (creator.length > 0 && !(r.ownerUsername && creator.includes(r.ownerUsername))) return false;
      if (outMin > 0 && (r.outlier[outMetric] ?? -1) < outMin) return false;
      if (r.ownerUsername && excluded.includes(r.ownerUsername)) return false;
      if (goalFilter !== "all" && !r.goals.includes(goalFilter as ReelGoal)) return false;
      if (range !== "all") {
        const ts = r.postedAt ? new Date(r.postedAt).getTime() : null;
        if (ts == null || ts < minTs || ts > maxTs) return false;
      }
      if (q) {
        const hit = [r.hookText, r.transcript, r.ownerUsername].filter(Boolean).some((f) => f!.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
    const val = (r: LibraryRow): number => {
      if (sortKey === "outlier") return r.outlier[outMetric] ?? -Infinity;
      if (sortKey === "date") return r.postedAt ? new Date(r.postedAt).getTime() : -Infinity;
      if (sortKey === "shares") return r.sharesCount ?? -Infinity;
      if (sortKey === "saves") return r.savesCount ?? -Infinity;
      if (sortKey === "reposts") return r.repostsCount ?? -Infinity;
      if (sortKey === "engagement") return r.views > 0 ? r.commentsCount / r.views : -Infinity;
      if (sortKey === "comments") return r.commentsCount;
      return r[sortKey] as number;
    };
    return [...filtered].sort((a, b) => (val(a) - val(b)) * dir);
  }

  const hooks = useMemo(() => filterAndSort(live), [live, query, creator, outMetric, outMin, excluded, range, dateFrom, dateTo, sortKey, dir, goalFilter]);
  const scripts = useMemo(() => filterAndSort(scriptRows), [scriptRows, query, creator, outMetric, outMin, excluded, range, dateFrom, dateTo, sortKey, dir, goalFilter]);

  const hasFilters = !!query || creator.length > 0 || outMin > 0 || excluded.length > 0 || range !== "all" || goalFilter !== "all";
  function clearFilters() {
    setQuery("");
    setCreator([]);
    setOutMin(0);
    setExcluded([]);
    setRange("all");
    setGoalFilter("all");
  }

  function handleCopy(row: LibraryRow, isScript: boolean) {
    const text = isScript ? row.transcript ?? row.hookText : row.hookText;
    navigator.clipboard?.writeText(text).catch(() => {});
    setMenuId(null);
    flash("Copied");
  }

  function handleUseInIdea(row: LibraryRow) {
    setMenuId(null);
    useReelInNewIdea(row.id, row.hookText)
      .then(() => flash("Added to Ideas as a new Draft", "/idea"))
      .catch(() => flash("Something went wrong"));
  }

  function handleRemove(row: LibraryRow) {
    setMenuId(null);
    setRemoved((prev) => new Set(prev).add(row.id));
    removeFromLibrary(row.id).catch(() => {});
    flash("Removed from Library");
  }

  const list = tab === "hooks" ? hooks : scripts;

  return (
    <>
      <div className="flex flex-wrap gap-3 max-sm:flex-nowrap max-sm:gap-2">
        <button
          type="button"
          onClick={() => {
            setTab("hooks");
            setMenuId(null);
          }}
          className="flex min-w-[230px] items-center gap-3 rounded-lg px-4.5 py-2.5 text-left transition-colors max-sm:min-w-0 max-sm:flex-1 max-sm:gap-2 max-sm:px-3"
          style={{
            background: tab === "hooks" ? "#FF1F8F" : "#FFFFFF",
            color: tab === "hooks" ? "#FFFFFF" : "#0D0D0D",
            border: `1px solid ${tab === "hooks" ? "#FF1F8F" : "#F0F0F1"}`,
            boxShadow: tab === "hooks" ? "0 6px 18px rgba(255,31,143,0.25)" : "0 4px 16px rgba(13,13,13,0.06)",
          }}
        >
          <span
            className="flex size-9 flex-none items-center justify-center rounded-lg max-sm:size-8"
            style={{ background: tab === "hooks" ? "rgba(255,255,255,0.18)" : "#F6F6F5" }}
          >
            <MaterialIcon name="phishing" size={21} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-baseline gap-2 text-[16px] font-extrabold">
              Hooks <span className="text-xs font-bold opacity-70">{live.length}</span>
            </span>
            <span className="text-xs font-medium whitespace-nowrap opacity-85 max-sm:hidden">Saved opening lines</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("scripts");
            setMenuId(null);
          }}
          className="flex min-w-[230px] items-center gap-3 rounded-lg px-4.5 py-2.5 text-left transition-colors max-sm:min-w-0 max-sm:flex-1 max-sm:gap-2 max-sm:px-3"
          style={{
            background: tab === "scripts" ? "#FF1F8F" : "#FFFFFF",
            color: tab === "scripts" ? "#FFFFFF" : "#0D0D0D",
            border: `1px solid ${tab === "scripts" ? "#FF1F8F" : "#F0F0F1"}`,
            boxShadow: tab === "scripts" ? "0 6px 18px rgba(255,31,143,0.25)" : "0 4px 16px rgba(13,13,13,0.06)",
          }}
        >
          <span
            className="flex size-9 flex-none items-center justify-center rounded-lg max-sm:size-8"
            style={{ background: tab === "scripts" ? "rgba(255,255,255,0.18)" : "#F6F6F5" }}
          >
            <MaterialIcon name="description" size={21} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-baseline gap-2 text-[16px] font-extrabold">
              Transcript <span className="text-xs font-bold opacity-70">{scriptRows.length}</span>
            </span>
            <span className="text-xs font-medium whitespace-nowrap opacity-85 max-sm:hidden">Full saved transcripts</span>
          </span>
        </button>
      </div>

      <div className="flex flex-col rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <div className="flex flex-wrap items-end gap-3 border-b border-[#F0F0F1] px-6 py-5 max-sm:gap-2 max-sm:px-3 max-sm:py-3">
          <div className="flex h-[42px] min-w-[220px] flex-1 basis-[280px] items-center gap-2.5 rounded-md border border-[#E4E4E2] px-3 focus-within:border-[#0D0D0D] max-sm:h-9 max-sm:min-w-0 max-sm:basis-full">
            <MaterialIcon name="search" size={20} className="text-[#4a4a48]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "hooks" ? "Search hooks…" : "Search transcripts…"}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-[#0D0D0D] outline-none"
            />
          </div>

          <ExcludeCreators
            variant="include"
            creators={creators}
            value={creator}
            onChange={setCreator}
            labelClass="text-xs font-bold text-[#4a4a48]"
            heightClass="h-[42px] max-sm:h-9"
            className="w-[170px] flex-none gap-1.5 max-sm:w-[calc(50%-4px)] max-sm:gap-1"
          />

          <ExcludeCreators
            creators={creators}
            value={excluded}
            onChange={setExcluded}
            labelClass="text-xs font-bold text-[#4a4a48]"
            heightClass="h-[42px] max-sm:h-9"
            className="w-[170px] flex-none gap-1.5 max-sm:w-[calc(50%-4px)] max-sm:gap-1"
          />

          <div className="flex w-[170px] flex-none flex-col gap-1.5 max-sm:w-[calc(50%-4px)] max-sm:min-w-0 max-sm:gap-1">
            <span className="text-xs font-bold text-[#4a4a48]">Outlier Score</span>
            <OutlierFilter wide metric={outMetric} min={outMin} onChange={(m, n) => { setOutMetric(m); setOutMin(n); }} />
          </div>

          <div className="flex w-[150px] flex-none flex-col gap-1.5 max-sm:w-[calc(50%-4px)] max-sm:min-w-0 max-sm:gap-1">
            <span className="text-xs font-bold text-[#4a4a48]">Built For</span>
            <div className="relative">
              <select
                value={goalFilter}
                onChange={(e) => setGoalFilter(e.target.value)}
                className="h-[42px] w-full appearance-none rounded-md border border-[#E4E4E2] bg-white px-3 pr-8 text-[13.5px] font-semibold text-[#0D0D0D] outline-none max-sm:h-9 max-sm:px-2.5"
              >
                <option value="all">All goals</option>
                <option value="views">Views</option>
                <option value="shares">Shares</option>
                <option value="comments">Comments</option>
                <option value="saves">Saves</option>
              </select>
              <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-3 right-2.5 text-[#4a4a48] max-sm:top-2.5 max-sm:right-2" />
            </div>
          </div>

          <div className="flex w-[150px] flex-none flex-col gap-1.5 max-sm:w-[calc(50%-4px)] max-sm:min-w-0 max-sm:gap-1">
            <span className="text-xs font-bold text-[#4a4a48]">Posted Date</span>
            <div className="relative">
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as RangeKey)}
                className="h-[42px] w-full appearance-none rounded-md border border-[#E4E4E2] bg-white px-3 pr-8 text-[13.5px] font-semibold text-[#0D0D0D] outline-none max-sm:h-9 max-sm:px-2.5"
              >
                <option value="all">Any date</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="custom">Custom</option>
              </select>
              <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-3 right-2.5 text-[#4a4a48] max-sm:top-2.5 max-sm:right-2" />
            </div>
          </div>

          <div className="flex flex-none flex-col gap-1.5 max-sm:w-full max-sm:gap-1">
            <span className="text-xs font-bold text-[#4a4a48]">Sort by</span>
            <div className="flex gap-2">
              <div className="relative w-40 max-sm:w-auto max-sm:flex-1">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="h-[42px] w-full appearance-none rounded-md border border-[#E4E4E2] bg-white px-3 pr-8 text-[13.5px] font-semibold text-[#0D0D0D] outline-none max-sm:h-9 max-sm:px-2.5"
                >
                  <option value="views">Views</option>
                  <option value="likes">Likes</option>
                  <option value="comments">Comments</option>
                  <option value="shares">Shares</option>
                  <option value="saves">Saves</option>
                  <option value="reposts">Reposts</option>
                  <option value="engagement">Engagement rate</option>
                  <option value="date">Posted date</option>
                  <option value="outlier">Outlier score</option>
                </select>
                <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-3 right-2.5 text-[#4a4a48] max-sm:top-2.5 max-sm:right-2" />
              </div>
              <button
                type="button"
                onClick={() => setDir((d) => (d === -1 ? 1 : -1))}
                title={dir === -1 ? "Highest first" : "Lowest first"}
                className="flex size-[42px] flex-none items-center justify-center rounded-md border border-[#E4E4E2] hover:border-[#BDBDBB] max-sm:size-9"
              >
                <MaterialIcon name={dir === -1 ? "arrow_downward" : "arrow_upward"} size={20} />
              </button>
            </div>
          </div>
        </div>

        {range === "custom" && (
          <div className="flex items-center gap-2 border-b border-[#F0F0F1] px-6 py-3.5 text-[13px] font-semibold text-[#4a4a48] max-sm:flex-wrap max-sm:px-3 max-sm:py-2.5">
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

        {hasFilters && (
          <div className="flex items-center justify-end gap-3 px-6 py-3 text-[13px] font-semibold text-[#4a4a48] max-sm:px-3 max-sm:py-2">
            <button
              type="button"
              onClick={clearFilters}
              className="font-bold text-[#0D0D0D] underline decoration-2 underline-offset-[3px] hover:text-[#FF1F8F]"
            >
              Clear filters
            </button>
          </div>
        )}

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 border-t border-[#F0F0F1] px-6 py-14 text-center">
            <span className="text-lg font-extrabold">Nothing Matches These Filters</span>
            <button
              type="button"
              onClick={clearFilters}
              className="font-bold underline decoration-2 underline-offset-[3px] hover:text-[#FF1F8F]"
            >
              Clear filters
            </button>
          </div>
        ) : tab === "hooks" ? (
          <div className="flex flex-col">
            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,150px)_96px_36px] gap-4 border-t border-[#F0F0F1] bg-[#FBFBFA] px-6 py-2.5 text-[12.5px] font-semibold text-[#6b6b69] sm:grid">
              <span>Hook</span>
              <span>Creator</span>
              <span>Posted Date</span>
              <span />
            </div>
            {hooks.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-[#F0F0F1] px-3 py-3 hover:bg-[#FBFBFA] sm:grid-cols-[minmax(0,1fr)_minmax(0,150px)_96px_36px] sm:items-center sm:gap-4 sm:px-6 sm:py-3.5"
              >
                <div className="flex min-w-0 flex-col gap-1.5 max-sm:col-start-1 max-sm:row-start-1 max-sm:gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="min-w-0 flex-1 text-[14px] leading-[1.35] tracking-[-0.01em] text-pretty">{row.hookText}</span>
                    <OpenReelButton id={row.id} className="max-sm:hidden" />
                  </div>
                  <StatsRow row={row} />
                </div>
                <div className="flex min-w-0 items-center gap-2.5 max-sm:col-start-1 max-sm:row-start-2 max-sm:gap-2">
                  <Avatar row={row} />
                  <span className="truncate text-[13.5px] font-medium text-[#4a4a48] max-sm:text-[12.5px]">
                    {row.ownerUsername ? `@${row.ownerUsername}` : "—"}
                  </span>
                  <OutlierBadge value={row.outlier[outMetric]} metric={outMetric} />
                  <span className="text-[12.5px] font-medium whitespace-nowrap text-[#7a7a78] sm:hidden">· {fmtDate(row.postedAt)}</span>
                  <OpenReelButton id={row.id} className="ml-auto sm:hidden" />
                </div>
                <span className="text-[13.5px] font-medium whitespace-nowrap text-[#4a4a48] max-sm:hidden">{fmtDate(row.postedAt)}</span>
                <RowMenu
                  className="max-sm:col-start-2 max-sm:row-start-1"
                  open={menuId === row.id}
                  onToggle={() => setMenuId((m) => (m === row.id ? null : row.id))}
                  onCopy={() => handleCopy(row, false)}
                  onUseInIdea={() => handleUseInIdea(row)}
                  onRemove={() => handleRemove(row)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,150px)_96px_36px] gap-4 border-t border-[#F0F0F1] bg-[#FBFBFA] px-6 py-2.5 text-[12.5px] font-semibold text-[#6b6b69] sm:grid">
              <span>Transcript</span>
              <span>Creator</span>
              <span>Posted Date</span>
              <span />
            </div>
            {scripts.map((row) => {
              const open = openIds.has(row.id);
              const fullText = row.transcript ?? "";
              const words = countWords(fullText);
              const toggleOpen = () =>
                setOpenIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(row.id)) next.delete(row.id);
                  else next.add(row.id);
                  return next;
                });
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-[#F0F0F1] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,150px)_96px_36px] sm:items-start sm:gap-4 sm:px-6 sm:py-3.5"
                >
                  <div className="flex min-w-0 flex-col gap-3 max-sm:col-start-1 max-sm:row-start-1 max-sm:gap-2">
                    <div className="flex items-start gap-2.5">
                      <div
                        role="button"
                        tabIndex={0}
                        title={open ? "Click to collapse" : "Click to read the full transcript"}
                        onClick={() => {
                          if (window.getSelection()?.toString()) return;
                          toggleOpen();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleOpen();
                          }
                        }}
                        className={`min-w-0 flex-1 cursor-pointer text-[14px] leading-[1.5] tracking-[-0.01em] whitespace-pre-wrap text-pretty ${open ? "" : "line-clamp-3"}`}
                      >
                        {open ? (
                          <span className="flex flex-col gap-3">
                            {toParagraphs(fullText).map((para, i) => (
                              <span key={i}>{para}</span>
                            ))}
                          </span>
                        ) : (
                          fullText
                        )}
                      </div>
                      <button
                        type="button"
                        title={open ? "Collapse" : "Expand"}
                        onClick={toggleOpen}
                        className="flex size-[30px] flex-none items-center justify-center rounded-md border border-[#E4E4E2] text-[#4a4a48] hover:border-[#BDBDBB] hover:text-[#0D0D0D]"
                      >
                        <MaterialIcon name={open ? "expand_less" : "expand_more"} size={22} />
                      </button>
                      <OpenReelButton id={row.id} className="max-sm:hidden" />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] [font-variant-numeric:tabular-nums]">
                      <StatsRow row={row} />
                      {row.goals.length > 0 && (
                        <span className="flex items-center gap-1 rounded-[10px] bg-[#F0F0F1] px-2.5 py-0.5 text-[11.5px] font-bold">
                          <span className="font-medium text-[#6b6b69]">{row.goals.length > 1 ? "Goals" : "Goal"}</span>
                          {row.goals.map((g) => GOAL_LABELS[g]).join(" + ")}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-normal text-[#7a7a78]">
                        <MaterialIcon name="notes" size={14} className="text-[#9a9a98]" />
                        <span className="max-sm:hidden">Words</span>
                        <span className="text-[#0D0D0D]">{words.toLocaleString("en-US")}</span>
                      </span>
                      <span className="flex items-center gap-1 font-normal text-[#7a7a78]">
                        <MaterialIcon name="av_timer" size={14} className="text-[#9a9a98]" />
                        <span className="max-sm:hidden">Length</span>
                        <span className="text-[#0D0D0D]">{fmtLen(row.durationSeconds)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center gap-2.5 max-sm:col-start-1 max-sm:row-start-2 max-sm:gap-2">
                    <Avatar row={row} />
                    <span className="truncate text-[13.5px] font-medium text-[#4a4a48] max-sm:text-[12.5px]">
                      {row.ownerUsername ? `@${row.ownerUsername}` : "—"}
                    </span>
                    <span className="text-[12.5px] font-medium whitespace-nowrap text-[#7a7a78] sm:hidden">· {fmtDate(row.postedAt)}</span>
                    <OpenReelButton id={row.id} className="ml-auto sm:hidden" />
                  </div>
                  <span className="text-[13.5px] font-medium whitespace-nowrap text-[#4a4a48] max-sm:hidden">{fmtDate(row.postedAt)}</span>
                  <RowMenu
                    className="max-sm:col-start-2 max-sm:row-start-1"
                    open={menuId === row.id}
                    onToggle={() => setMenuId((m) => (m === row.id ? null : row.id))}
                    onCopy={() => handleCopy(row, true)}
                    onUseInIdea={() => handleUseInIdea(row)}
                    onRemove={() => handleRemove(row)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rows.length === 0 && (
        <p className="text-sm font-medium text-[#4a4a48]">
          Nothing saved yet — transcribe a reel from its{" "}
          <Link href="/reels" className="font-bold underline decoration-2 underline-offset-[3px] hover:text-[#FF1F8F]">
            Reel Detail
          </Link>{" "}
          page and its hook and transcript will show up here automatically.
        </p>
      )}

      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-[#0D0D0D] px-4.5 py-3 text-sm font-bold text-white shadow-[0_12px_32px_rgba(13,13,13,0.2)]">
          {toast}
          {toastHref && (
            <Link href={toastHref} className="ml-3 text-[#C6FF3D] underline underline-offset-2 hover:text-white">
              View in Ideas
            </Link>
          )}
        </div>
      )}
    </>
  );
}


function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function OpenReelButton({ id, className = "" }: { id: string; className?: string }) {
  return (
    <Link
      href={`/analyze-reel/reel/${id}?from=library`}
      prefetch={false}
      title="Open reel detail"
      aria-label="Open reel detail"
      className={`flex size-[30px] flex-none items-center justify-center rounded-md border border-[#E4E4E2] text-[#4a4a48] hover:border-[#BDBDBB] hover:text-[#FF1F8F] ${className}`}
    >
      <MaterialIcon name="open_in_new" size={18} />
    </Link>
  );
}
