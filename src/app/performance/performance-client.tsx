"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelThumb } from "@/components/reel-thumb";
import type { MyReel } from "@/lib/performance";
import { fmtN } from "@/lib/format";
import { refreshSummary } from "@/app/settings/connections-actions";
import { remakeWinner } from "./actions";

const fmtCount = (n: number | null) => (n == null ? "—" : fmtN(n));
const pct = (x: number | null) => (x == null ? "—" : (x * 100).toFixed(x >= 0.1 ? 1 : 2) + "%");
const score = (x: number | null) => (x == null ? "—" : x.toFixed(1) + "x");
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" }) : "");

type SortKey = "viewsScore" | "commentsScore" | "sharesPerView" | "watchPct" | "savesPerView" | "commentsPerView" | "follows" | "views";

// The signals that matter, in the order that matters.
const COLS: { key: SortKey; label: string; icon: string; tip: string; show: (r: MyReel) => string }[] = [
  { key: "sharesPerView", label: "Shares", icon: "send", tip: "Shares per view: the strongest sign Instagram will show it to new people", show: (r) => pct(r.sharesPerView) },
  { key: "watchPct", label: "Watched", icon: "timer", tip: "How much of the reel people watch", show: (r) => (r.watchPct != null ? pct(r.watchPct) : r.avgWatchSeconds != null ? r.avgWatchSeconds.toFixed(1) + "s" : "—") },
  { key: "savesPerView", label: "Saves", icon: "bookmark", tip: "Saves per view: people want to come back to it", show: (r) => pct(r.savesPerView) },
  { key: "commentsPerView", label: "Comments", icon: "comment", tip: "Comments per view: it sparked something", show: (r) => pct(r.commentsPerView) },
  { key: "follows", label: "Follows", icon: "person_add", tip: "Followers this reel brought in", show: (r) => fmtCount(r.follows) },
  { key: "views", label: "Views", icon: "visibility", tip: "Views: the result of everything above", show: (r) => fmtCount(r.views) },
];

function Tile({ icon, label, value, note }: { icon: string; label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#F0F0F1] bg-white p-3.5 shadow-[0_4px_16px_rgba(13,13,13,0.07)] md:p-4">
      <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-[#FFF0F7] text-[#FF1F8F]">
        <MaterialIcon name={icon} size={24} weight={500} />
      </span>
      <div className="min-w-0">
        <div className="text-[12.5px] font-bold text-[#6b6b69] max-md:text-[14px]">{label}</div>
        <div className="text-[26px] leading-none font-black tracking-[-0.02em] max-md:text-[24px]">{value}</div>
        {note && <div className="mt-1 text-[12.5px] font-semibold text-[#4a4a48] max-md:text-[14px]">{note}</div>}
      </div>
    </div>
  );
}

export function PerformanceClient({
  connected,
  salesConnected,
  reels,
  summary,
  summaryAt,
  followers,
  followerChange,
  revenue30,
}: {
  connected: boolean;
  salesConnected: boolean;
  reels: MyReel[];
  summary: string | null;
  summaryAt: string | null;
  followers: number | null;
  followerChange: number | null;
  revenue30: number | null;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("viewsScore");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(summary);

  const sorted = useMemo(
    () => [...reels].sort((a, b) => (((a[sortKey] as number | null) ?? -Infinity) - ((b[sortKey] as number | null) ?? -Infinity)) * dir),
    [reels, sortKey, dir],
  );
  const top5 = useMemo(() => [...reels].filter((r) => r.viewsScore != null).sort((a, b) => (b.viewsScore ?? 0) - (a.viewsScore ?? 0)).slice(0, 5), [reels]);
  const viewValues = reels.map((r) => r.views).filter((v): v is number => v != null);
  const avgViews = viewValues.length ? viewValues.reduce((s, v) => s + v, 0) / viewValues.length : null;

  function sortBy(k: SortKey) {
    if (k === sortKey) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setDir(-1);
    }
  }

  if (!connected) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-[#F0F0F1] bg-white px-5 py-14 text-center shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <span className="flex size-12 items-center justify-center rounded-full bg-[#FFF0F7] text-[#FF1F8F]">
          <MaterialIcon name="monitoring" size={26} weight={500} />
        </span>
        <span className="text-[18px] font-black">Connect Instagram To See Your Numbers</span>
        <span className="max-w-[420px] text-[14px] font-medium text-[#4a4a48] max-md:text-[16px]">
          This page ranks your own reels by what Instagram rewards: shares, watch time, saves, comments, follows and views. It fills in once your Instagram is connected.
        </span>
        <Link href="/settings" className="mt-1 flex h-11 items-center gap-2 rounded-md bg-[#FF1F8F] px-5 text-[14px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] max-md:h-12 max-md:text-[16px]">
          <MaterialIcon name="link" size={18} weight={500} /> Go To Connections
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Tile icon="group" label="Followers" value={fmtCount(followers)} note={followerChange != null ? `${followerChange >= 0 ? "+" : ""}${fmtCount(followerChange)} in 30 days` : undefined} />
        <Tile icon="payments" label="Revenue, 30 Days" value={revenue30 != null ? money(revenue30) : "—"} note={salesConnected ? undefined : "Connect Stripe"} />
        <Tile icon="video_library" label="Reels Tracked" value={String(reels.length)} />
        <Tile icon="visibility" label="Average Views" value={fmtCount(avgViews)} />
      </div>

      <div className="flex flex-col gap-2.5 rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.07)] md:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[20px] font-black tracking-[-0.02em] md:text-[24px]">This Week</span>
          <button
            type="button"
            disabled={pending || reels.length < 3}
            onClick={() =>
              startTransition(async () => {
                setText(await refreshSummary());
              })
            }
            className="flex h-10 items-center gap-1.5 rounded-md border border-[#E4E4E2] bg-white px-3.5 text-[13.5px] font-bold hover:border-[#0D0D0D] disabled:opacity-50 max-md:h-11 max-md:text-[15px]"
          >
            <MaterialIcon name="refresh" size={18} weight={500} /> {pending ? "Writing…" : "Refresh"}
          </button>
        </div>
        <p className="text-[15px] leading-[1.6] font-medium text-[#0D0D0D] md:text-[16px]">
          {text ?? (reels.length < 3 ? "Once you have a few reels tracked, a short summary of your week shows up here." : "Your summary is being written. Refresh in a moment.")}
        </p>
        {summaryAt && text && <span className="text-[12.5px] font-semibold text-[#6b6b69]">Written {day(summaryAt)}</span>}
      </div>

      {top5.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.07)] md:p-5">
          <span className="mb-1 text-[20px] font-black tracking-[-0.02em] md:text-[24px]">Your Top 5</span>
          {top5.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 border-t border-[#F0F0F1] py-3 first:border-t-0 max-md:flex-wrap">
              <span className="w-5 flex-none text-[15px] font-black text-[#FF1F8F]">{i + 1}</span>
              <ReelThumb url={r.thumbnailUrl} className="max-md:h-[60px] max-md:w-[46px]" />
              <div className="min-w-0 flex-1 max-md:basis-[calc(100%-90px)]">
                <div className="text-[15px] font-semibold break-words md:text-[16px]">{(r.caption ?? "").replace(/\s+/g, " ").slice(0, 120) || "(no caption)"}</div>
                <div className="text-[13px] font-semibold text-[#4a4a48] max-md:text-[14px]">
                  {score(r.viewsScore)} your average views · {fmtCount(r.views)} views · {day(r.postedAt)}
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const { id } = await remakeWinner(r.caption);
                    router.push(`/scripts/${id}`);
                  })
                }
                className="flex h-10 flex-none items-center gap-1.5 rounded-md border border-[#FF1F8F] bg-[#FF1F8F] px-3.5 text-[13.5px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60 max-md:h-11 max-md:w-full max-md:justify-center max-md:text-[15px]"
              >
                <MaterialIcon name="auto_fix_high" size={17} weight={500} /> Remake This Winner
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <div className="px-4 pt-4 pb-3 md:px-6 md:pt-5">
          <span className="text-[20px] font-black tracking-[-0.02em] md:text-[24px]">Every Reel</span>
          <p className="mt-0.5 text-[13px] font-semibold text-[#4a4a48] max-md:text-[14px]">Ranked by what Instagram rewards, strongest signal first. Tap a column to sort.</p>
        </div>
        <div className="overflow-x-auto max-md:hidden">
          <div style={{ minWidth: 980 }}>
            <div className="grid items-center gap-2 border-y border-[#F0F0F1] bg-[#FBFBFA] px-6 py-2.5 text-xs font-bold text-[#4a4a48]" style={{ gridTemplateColumns: "minmax(280px,1fr) 84px 84px repeat(6,84px)" }}>
              <span>Reel</span>
              {([["viewsScore", "Views Score"], ["commentsScore", "Comments Score"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => sortBy(k)} className="flex items-center justify-center gap-0.5 text-[#0D0D0D] hover:text-[#FF1F8F]">
                  {l} <MaterialIcon name={sortKey === k ? (dir === 1 ? "arrow_upward" : "arrow_downward") : "unfold_more"} size={14} />
                </button>
              ))}
              {COLS.map((c) => (
                <button key={c.key} type="button" onClick={() => sortBy(c.key)} title={c.tip} className="flex items-center justify-center gap-0.5 text-[#0D0D0D] hover:text-[#FF1F8F]">
                  <MaterialIcon name={c.icon} size={17} weight={500} /> <MaterialIcon name={sortKey === c.key ? (dir === 1 ? "arrow_upward" : "arrow_downward") : "unfold_more"} size={14} />
                </button>
              ))}
            </div>
            {sorted.map((r) => (
              <div key={r.id} className="grid items-center gap-2 border-b border-[#F0F0F1] px-6 py-2.5 text-[13px] [font-variant-numeric:tabular-nums] hover:bg-[#FBFBFA]" style={{ gridTemplateColumns: "minmax(280px,1fr) 84px 84px repeat(6,84px)" }}>
                <a href={r.permalink ?? "#"} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-3 hover:text-[#FF1F8F]">
                  <ReelThumb url={r.thumbnailUrl} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium break-words">{(r.caption ?? "").replace(/\s+/g, " ").slice(0, 110) || "(no caption)"}</span>
                    <span className="text-xs font-semibold text-[#4a4a48]">{day(r.postedAt)}</span>
                  </span>
                </a>
                <span className="justify-self-center font-bold">{score(r.viewsScore)}</span>
                <span className="justify-self-center font-bold">{score(r.commentsScore)}</span>
                {COLS.map((c) => (
                  <span key={c.key} className="justify-self-center">
                    {c.show(r)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="md:hidden">
          <div className="flex gap-2 overflow-x-auto border-y border-[#F0F0F1] bg-[#FBFBFA] px-3 py-2">
            {([["viewsScore", "Views Score"], ["commentsScore", "Comments Score"], ...COLS.map((c) => [c.key, c.label])] as [SortKey, string][]).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => sortBy(k)}
                className="flex h-10 flex-none items-center gap-1 rounded-md border px-3 text-[14px] font-bold whitespace-nowrap"
                style={{ background: sortKey === k ? "#0D0D0D" : "#FFFFFF", color: sortKey === k ? "#FFFFFF" : "#0D0D0D", borderColor: sortKey === k ? "#0D0D0D" : "#E4E4E2" }}
              >
                {l}
                {sortKey === k && <MaterialIcon name={dir === 1 ? "arrow_upward" : "arrow_downward"} size={15} />}
              </button>
            ))}
          </div>
          {sorted.map((r) => (
            <a key={r.id} href={r.permalink ?? "#"} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-2.5 border-b border-[#F0F0F1] px-3 py-3">
              <div className="flex items-start gap-3">
                <ReelThumb url={r.thumbnailUrl} className="max-md:h-[68px] max-md:w-[52px]" />
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] leading-snug font-semibold break-words">{(r.caption ?? "").replace(/\s+/g, " ").slice(0, 110) || "(no caption)"}</div>
                  <div className="text-[14px] font-semibold text-[#4a4a48]">{day(r.postedAt)}</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-x-2 gap-y-2 text-center text-[14px] font-semibold">
                {[{ label: "Views Score", v: score(r.viewsScore) }, { label: "Comments Score", v: score(r.commentsScore) }, ...COLS.map((c) => ({ label: c.label, v: c.show(r) }))].map((m) => (
                  <div key={m.label} className="flex flex-col rounded-md bg-[#F6F6F5] px-1 py-1.5">
                    <span className="text-[12px] font-bold text-[#6b6b69]">{m.label}</span>
                    <span className="text-[15px] font-extrabold">{m.v}</span>
                  </div>
                ))}
              </div>
            </a>
          ))}
        </div>
        {reels.length === 0 && <p className="px-6 py-10 text-center text-[15px] font-medium text-[#4a4a48]">No reels yet. Your reels appear after the first update from Instagram.</p>}
      </div>
    </div>
  );
}
