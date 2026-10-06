"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { QueueClient, type QueueRow } from "./queue-client";
import { hidePull } from "./pulls-actions";

export type PulledReel = {
  id: string;
  caption: string | null;
  views: number;
  commentsCount: number;
  sharesCount: number | null;
};

export type RecentPull = {
  id: string;
  isProfile: boolean;
  name: string;
  reelCount: number;
  createdAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
};

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/.0$/, "") + "k";
  return Math.round(n).toLocaleString("en-US");
}

function fmtShortDate(value: string) {
  const d = new Date(value);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

function pct(part: number | null, base: number) {
  if (part == null || base <= 0) return "";
  return `(${((part / base) * 100).toFixed(2).replace(/0$/, "")}%)`;
}

export function ResearchResults({
  rows,
  queueRows,
  pulls,
}: {
  rows: PulledReel[];
  queueRows: QueueRow[];
  pulls: RecentPull[];
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const visiblePulls = pulls.filter((p) => !hidden.has(p.id));

  function removePull(id: string) {
    setHidden((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        await hidePull(id);
      } catch {
        setHidden((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  const insightsSource = rows;
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
  const scopeLabel = "Across all pulled reels";

  return (
    <>
      <div className="flex flex-wrap items-stretch gap-5">
        <div className="min-w-0 flex-1 max-md:basis-full rounded-lg border border-[#F0F0F1] bg-white p-3 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:min-w-[420px] md:p-5">
          <div className="mb-2.5 flex flex-wrap items-center gap-2.5 md:mb-3.5">
            <span className="text-xl font-black tracking-[-0.02em] md:text-2xl">Queue</span>
            <span className="flex size-[26px] items-center justify-center rounded-full bg-[#0D0D0D] text-[12.5px] font-extrabold text-[#E6FF00]">
              {queueRows.length}
            </span>
            <span className="text-xs font-medium text-[#4a4a48]">Shared from your phone</span>
          </div>
          {queueRows.length === 0 ? (
            <div className="flex items-center gap-2.5 py-1.5 text-[13px] font-medium text-[#4a4a48] md:py-2.5 md:text-[13.5px]">
              <MaterialIcon name="inbox" size={22} />
              Nothing waiting. Reels you share from Instagram land here.
            </div>
          ) : (
            <QueueClient rows={queueRows} />
          )}
        </div>

        <div className="min-w-0 flex-1 max-md:basis-full rounded-lg border border-[#F0F0F1] bg-white p-3 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:min-w-[360px] md:p-5">
          <div className="mb-2.5 flex items-baseline gap-3 md:mb-3.5">
            <span className="text-xl font-black tracking-[-0.02em] md:text-2xl">Insights</span>
            <span className="text-[13px] font-semibold text-[#4a4a48]">{scopeLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 rounded-lg border border-[#F0F0F1] p-3 md:gap-3.5 md:p-4">
              <span className="flex size-8 flex-none md:size-10 items-center justify-center rounded-lg bg-[#FFF0F7] text-[#FF1F8F]">
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
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 pt-3 pb-2.5 md:gap-3.5 md:px-6 md:pt-4.5 md:pb-3.5">
          <div className="flex flex-wrap items-baseline gap-3 max-md:contents">
            <span className="text-[20px] md:text-[26px] font-black tracking-[-0.02em] max-md:order-1">Recent Pulls</span>
            <span className="text-[13px] font-semibold text-[#4a4a48] max-md:order-3 max-md:basis-full">
              Pulls from the last 7 days. Removing one here keeps its reels in All Reels.
            </span>
          </div>
          <Link
            href="/reels"
            className="flex h-8 flex-none items-center gap-1.5 rounded-md border border-[#0D0D0D] px-2.5 text-[12.5px] font-bold max-md:order-2 max-md:border-[#FF1F8F] max-md:bg-[#FF1F8F] max-md:text-white md:h-[38px] md:px-3.5 md:text-[13px] whitespace-nowrap hover:bg-[#0D0D0D] hover:text-white"
          >
            Go To All Reels
            <MaterialIcon name="arrow_forward" size={17} />
          </Link>
        </div>
        {visiblePulls.length === 0 && (
          <div className="border-t border-[#F0F0F1] px-3 py-3 text-[13.5px] md:px-6 md:py-5.5 font-medium text-[#4a4a48]">
            No pulls in the last 7 days.
          </div>
        )}
        {visiblePulls.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[#F0F0F1] px-3 py-2.5 max-md:gap-x-3 md:px-6 md:py-3"
          >
            <span className="flex size-9 flex-none items-center justify-center rounded-full bg-[#F0F0F1]">
              <MaterialIcon name={p.isProfile ? "person" : "movie"} size={19} />
            </span>
            <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5 max-md:flex-1">
              <span className="truncate text-sm font-bold">{p.name}</span>
              <span className="text-xs font-medium text-[#4a4a48]">
                {p.isProfile
                  ? `Profile Pull · ${p.reelCount} reel${p.reelCount === 1 ? "" : "s"} · ${fmtShortDate(p.createdAt)} · Avg per reel`
                  : `Single Reel${p.reelCount > 1 ? "s" : ""} · ${fmtShortDate(p.createdAt)}${p.reelCount > 1 ? " · Avg per reel" : ""}`}
              </span>
            </span>
            <div className="grid max-w-[460px] flex-[1_1_380px] grid-cols-4 gap-3 [font-variant-numeric:tabular-nums] max-md:order-3 max-md:basis-full">
              {(
                [
                  ["Views", p.views, ""],
                  ["Likes", p.likes, pct(p.likes, p.views)],
                  ["Comments", p.comments, pct(p.comments, p.views)],
                  ["Shares", p.shares, pct(p.shares, p.views)],
                ] as const
              ).map(([label, value, share]) => (
                <span key={label} className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold text-[#4a4a48]">{label}</span>
                  <span className="text-[13px] whitespace-nowrap">
                    {value == null ? "—" : fmtN(value)}{" "}
                    <span className="font-medium text-[#7a7a78]">{share}</span>
                  </span>
                </span>
              ))}
            </div>
            <Link
              href="/reels"
              className="ml-auto flex items-center max-md:hidden gap-1 text-[13px] font-bold whitespace-nowrap hover:text-[#FF1F8F]"
            >
              View In All Reels
              <MaterialIcon name="arrow_forward" size={17} />
            </Link>
            <button
              type="button"
              onClick={() => removePull(p.id)}
              title="Remove from Recent Pulls (reels stay in All Reels)"
              aria-label="Remove from Recent Pulls"
              className="flex size-7 flex-none items-center justify-center rounded text-[#4a4a48] max-md:order-2 hover:bg-[#F0F0F1] hover:text-[#0D0D0D]"
            >
              <MaterialIcon name="close" size={18} />
            </button>
          </div>
        ))}
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
      href={reel ? `/analyze-reel/reel/${reel.id}` : "#"}
      prefetch={false}
      className="flex min-w-0 items-center gap-2.5 rounded-lg border border-[#F0F0F1] p-3 hover:border-[#FF1F8F] md:gap-3.5 md:p-4"
    >
      <span className="flex size-8 flex-none items-center justify-center rounded-lg bg-[#FFF0F7] text-[#FF1F8F] md:size-10">
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
