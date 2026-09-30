"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QueueClient, type QueueRow } from "./queue-client";
import { transcribeSelectedReels } from "./[batchId]/actions";

export type PulledReel = {
  id: string;
  url: string;
  caption: string | null;
  thumbnailUrl: string | null;
  ownerUsername: string | null;
  postedAt: string | null;
  views: number;
  likes: number;
  commentsCount: number;
  sharesCount: number | null;
  commentRate: number;
  shareRate: number | null;
  viewsMultiplier: number | null;
  commentRateMultiplier: number | null;
  shareRateMultiplier: number | null;
  isSingle: boolean;
  transcriptionStatus: string | null;
};

type SortKey =
  | "postedAt"
  | "views"
  | "likes"
  | "commentsCount"
  | "sharesCount"
  | "commentRate"
  | "shareRate"
  | "compare";
type CompareKey = "views" | "comments" | "shares";

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
  return Math.round(n).toLocaleString("en-US");
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function compareValue(r: PulledReel, key: CompareKey) {
  return key === "views"
    ? r.viewsMultiplier
    : key === "comments"
      ? r.commentRateMultiplier
      : r.shareRateMultiplier;
}

export function ResearchResults({
  rows,
  queueRows,
}: {
  rows: PulledReel[];
  queueRows: QueueRow[];
}) {
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("postedAt");
  const [direction, setDirection] = useState<1 | -1>(-1);
  const [compareKey, setCompareKey] = useState<CompareKey>("views");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const creators = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.ownerUsername).filter((u): u is string => Boolean(u)))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [rows],
  );
  const hasSingles = rows.some((r) => r.isSingle);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (source === "singles" && !r.isSingle) return false;
      if (source !== "all" && source !== "singles" && r.ownerUsername !== source) return false;
      if (q) {
        const hit =
          (r.caption ?? "").toLowerCase().includes(q) ||
          (r.ownerUsername ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, source, query]);

  const sorted = useMemo(() => {
    const val = (r: PulledReel): number => {
      if (sortKey === "compare") return compareValue(r, compareKey) ?? -Infinity;
      if (sortKey === "postedAt") return r.postedAt ? new Date(r.postedAt).getTime() : 0;
      if (sortKey === "shareRate") return r.shareRate ?? -Infinity;
      return r[sortKey] as number;
    };
    return [...visible].sort((a, b) => (val(a) - val(b)) * direction);
  }, [visible, sortKey, direction, compareKey]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === 1 ? -1 : 1) as 1 | -1);
    } else {
      setSortKey(key);
      setDirection(-1);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  function toggleAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((r) => r.id)));
  }

  function handleTranscribeSelected() {
    setError(null);
    const ids = [...selected];
    startTransition(async () => {
      try {
        await transcribeSelectedReels(ids);
        setSelected(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const insightsSource = visible.length ? visible : rows;
  const mostViewed = insightsSource.length
    ? insightsSource.reduce((best, r) => (r.views > best.views ? r : best))
    : null;
  const mostCommented = insightsSource.length
    ? insightsSource.reduce((best, r) => (r.commentsCount > best.commentsCount ? r : best))
    : null;
  const shareable = insightsSource.filter((r) => r.sharesCount != null);
  const mostShared = shareable.length
    ? shareable.reduce((best, r) => ((r.sharesCount ?? 0) > (best.sharesCount ?? 0) ? r : best))
    : null;
  const scopeLabel =
    source === "all" ? "Across all pulled reels" : source === "singles" ? "Single reels only" : `For ${source}`;

  function arrowFor(key: SortKey) {
    if (sortKey !== key) return "unfold_more";
    return direction === -1 ? "expand_more" : "expand_less";
  }

  const cols: { label: string; key: SortKey }[] = [
    { label: "Views", key: "views" },
    { label: "Likes", key: "likes" },
    { label: "Comments", key: "commentsCount" },
    { label: "Shares", key: "sharesCount" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-stretch gap-5">
        <div className="min-w-[420px] flex-1 rounded-lg border border-[#F0F0F1] bg-white p-5 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
            <span className="text-2xl font-black tracking-[-0.02em]">Queue</span>
            <span className="flex size-[26px] items-center justify-center rounded-full bg-[#0D0D0D] text-[12.5px] font-extrabold text-[#E6FF00]">
              {queueRows.length}
            </span>
            <span className="text-xs font-medium text-[#4a4a48]">Shared from your phone</span>
          </div>
          {queueRows.length === 0 ? (
            <div className="flex items-center gap-2.5 py-2.5 text-[13.5px] font-medium text-[#4a4a48]">
              <MaterialIcon name="inbox" size={22} />
              Nothing waiting. Reels you share from Instagram land here.
            </div>
          ) : (
            <QueueClient rows={queueRows} />
          )}
        </div>

        <div className="min-w-[360px] flex-1 rounded-lg border border-[#F0F0F1] bg-white p-5 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          <div className="mb-3.5 flex items-baseline gap-3">
            <span className="text-2xl font-black tracking-[-0.02em]">Insights</span>
            <span className="text-[13px] font-semibold text-[#4a4a48]">{scopeLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3.5 rounded-lg border border-[#F0F0F1] p-4">
              <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-[#FFF0F7] text-[#FF1F8F]">
                <MaterialIcon name="stacks" size={21} weight={500} />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[32px] leading-none font-black tracking-[-0.03em]">
                  {insightsSource.length}
                </span>
                <span className="text-[13px] font-bold">Reels pulled</span>
              </div>
            </div>
            <MiniInsight icon="visibility" label="Most viewed" reel={mostViewed} value={mostViewed ? fmtN(mostViewed.views) : "—"} />
            <MiniInsight
              icon="chat_bubble"
              label="Most comments"
              reel={mostCommented}
              value={mostCommented ? fmtN(mostCommented.commentsCount) : "—"}
            />
            <MiniInsight
              icon="send"
              label="Most shared"
              reel={mostShared}
              value={mostShared ? fmtN(mostShared.sharesCount ?? 0) : "—"}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <div className="flex flex-wrap items-center justify-between gap-3.5 px-6 pt-4.5 pb-3.5">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-black tracking-[-0.02em]">Pulled Reels</span>
            <span className="text-[13px] font-semibold text-[#4a4a48]">
              {rows.length} reel{rows.length === 1 ? "" : "s"} · {creators.length} creator
              {creators.length === 1 ? "" : "s"}
              {visible.length !== rows.length ? ` · showing ${visible.length}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Select value={source} onValueChange={(v) => setSource(v ?? "all")}>
              <SelectTrigger size="sm" className="w-36">
                <SelectValue>
                  {(v: string) => (v === "all" ? "All sources" : v === "singles" ? "Single reels" : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {hasSingles && <SelectItem value="singles">Single reels</SelectItem>}
                {creators.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex h-9 w-[220px] items-center gap-2 rounded-md border border-[#E4E4E2] px-2.5">
              <MaterialIcon name="search" size={18} className="text-[#4a4a48]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reels…"
                className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium outline-none"
              />
            </div>
            {selected.size > 0 && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleTranscribeSelected}
                className="flex h-9 items-center gap-1.5 rounded-md bg-[#FF1F8F] px-4 text-[13.5px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60"
              >
                <MaterialIcon name="graphic_eq" size={18} weight={500} />
                {isPending ? "Starting…" : `Transcribe (${selected.size})`}
              </button>
            )}
          </div>
        </div>

        {error && <p className="px-6 pb-2 text-sm text-destructive">{error}</p>}

        <div className="max-h-[72vh] overflow-auto border-t border-[#F0F0F1]">
          <div className="min-w-[980px]">
            <div className="sticky top-0 z-10 grid grid-cols-[22px_34px_minmax(220px,1fr)_70px_76px_70px_82px_70px_150px] items-center gap-3.5 bg-[#FBFBFA] px-6 py-2.5 text-xs font-bold text-[#4a4a48]">
              <button onClick={toggleAll} aria-label="Select all">
                <span
                  className="flex size-4 items-center justify-center rounded-[3px] border-[1.5px]"
                  style={{
                    background: allVisibleSelected ? "#0D0D0D" : "#FFFFFF",
                    borderColor: allVisibleSelected ? "#0D0D0D" : "#BDBDBB",
                  }}
                >
                  {allVisibleSelected && <MaterialIcon name="check" size={12} className="text-white" />}
                </span>
              </button>
              <span>Post</span>
              <span />
              <button onClick={() => handleSort("postedAt")} className="flex items-center justify-end gap-0.5 hover:text-[#FF1F8F]">
                Posted <MaterialIcon name={arrowFor("postedAt")} size={16} />
              </button>
              {cols.map((c) => (
                <button
                  key={c.key}
                  onClick={() => handleSort(c.key)}
                  className="flex items-center justify-end gap-0.5 whitespace-nowrap hover:text-[#FF1F8F]"
                >
                  {c.label} <MaterialIcon name={arrowFor(c.key)} size={16} />
                </button>
              ))}
              <div className="flex items-center justify-end gap-1.5">
                <span>X</span>
                <Select value={compareKey} onValueChange={(v) => setCompareKey((v as CompareKey) ?? "views")}>
                  <SelectTrigger size="sm" className="h-6 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="views">views</SelectItem>
                    <SelectItem value="comments">comments</SelectItem>
                    <SelectItem value="shares">shares</SelectItem>
                  </SelectContent>
                </Select>
                <button onClick={() => handleSort("compare")} aria-label="Sort by comparison">
                  <MaterialIcon name={arrowFor("compare")} size={16} />
                </button>
              </div>
            </div>

            {sorted.length === 0 && (
              <div className="px-6 py-10 text-center text-sm font-medium text-[#4a4a48]">No reels match.</div>
            )}
            {sorted.map((r) => {
              const on = selected.has(r.id);
              const cv = compareValue(r, compareKey);
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[22px_34px_minmax(220px,1fr)_70px_76px_70px_82px_70px_150px] items-center gap-3.5 border-b border-[#F0F0F1] px-6 py-2 text-[13.5px] font-semibold [font-variant-numeric:tabular-nums] hover:bg-[#FBFBFA]"
                  style={{ background: on ? "#FFF0F7" : undefined }}
                >
                  <button onClick={() => toggle(r.id)} aria-label="Select reel">
                    <span
                      className="flex size-4 items-center justify-center rounded-[3px] border-[1.5px]"
                      style={{
                        background: on ? "#0D0D0D" : "#FFFFFF",
                        borderColor: on ? "#0D0D0D" : "#BDBDBB",
                      }}
                    >
                      {on && <MaterialIcon name="check" size={12} className="text-white" />}
                    </span>
                  </button>
                  <span className="flex items-center justify-center">
                    <InstagramGlyph />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link
                        href={`/research/reel/${r.id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {r.caption || "(no caption)"}
                      </Link>
                      {r.transcriptionStatus === "processing" && (
                        <span className="flex-none rounded-full bg-[#FFD9EB] px-2 py-0.5 text-[11px] font-bold">
                          Transcribing
                        </span>
                      )}
                    </div>
                    <span className="truncate text-xs font-medium text-[#4a4a48]">
                      {r.ownerUsername ? `@${r.ownerUsername}` : "—"} ·{" "}
                      {r.isSingle ? "Single reel" : "Profile pull"}
                    </span>
                  </div>
                  <span className="text-right text-[#4a4a48]">{fmtDate(r.postedAt)}</span>
                  <span className="text-right font-bold">{fmtN(r.views)}</span>
                  <span className="text-right">{fmtN(r.likes)}</span>
                  <span className="text-right">
                    {fmtN(r.commentsCount)}
                    <span className="text-[#4a4a48]"> ({(r.commentRate * 100).toFixed(2)}%)</span>
                  </span>
                  <span className="text-right" style={{ color: r.sharesCount == null ? "#9a9a98" : undefined }}>
                    {r.sharesCount != null ? fmtN(r.sharesCount) : "—"}
                  </span>
                  <div className="group relative flex justify-end">
                    {cv == null ? (
                      <span className="text-[#9a9a98]">—</span>
                    ) : cv >= 2 ? (
                      <span className="flex items-center gap-1 rounded-full bg-[#C6FF3D] px-2 py-0.5 text-xs font-extrabold">
                        <MaterialIcon name="bolt" size={14} weight={500} />
                        {cv.toFixed(1)}x
                      </span>
                    ) : (
                      <span className={cv >= 1 ? "font-bold" : "text-[#8a8a88]"}>{cv.toFixed(1)}x</span>
                    )}
                    {cv != null && (
                      <span className="pointer-events-none absolute right-0 bottom-full z-20 mb-2 rounded-md bg-[#0D0D0D] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                        {cv.toFixed(1)}x higher performance than creator&apos;s avg post
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="px-6 py-3 text-xs font-medium text-[#4a4a48]">
          Each reel is compared to its own creator&apos;s average. Standout = 2x or more. &quot;—&quot; means
          Instagram doesn&apos;t show shares for that reel.
        </p>
      </div>
    </>
  );
}

function MiniInsight({
  icon,
  label,
  value,
  reel,
}: {
  icon: string;
  label: string;
  value: string;
  reel: PulledReel | null;
}) {
  return (
    <Link
      href={reel ? `/research/reel/${reel.id}` : "#"}
      className="flex min-w-0 items-center gap-3.5 rounded-lg border border-[#F0F0F1] p-4 hover:border-[#FF1F8F]"
    >
      <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-[#FFF0F7] text-[#FF1F8F]">
        <MaterialIcon name={icon} size={21} weight={500} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-bold text-[#4a4a48]">{label}</span>
        <span className="text-xl leading-[1.05] font-black tracking-[-0.02em]">{value}</span>
        <span className="truncate text-xs font-semibold">{reel?.caption || "No reels yet"}</span>
      </div>
    </Link>
  );
}

function InstagramGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF1F8F" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="#FF1F8F" stroke="none" />
    </svg>
  );
}
