import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";

export type InsightReel = { id: string; caption: string | null; views: number; commentsCount: number; sharesCount: number | null };

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
  return Math.round(n).toLocaleString("en-US");
}

// The headline numbers across every reel in the Library.
export function InsightsPanel({ reels }: { reels: InsightReel[] }) {
  const best = <T,>(list: T[], by: (x: T) => number) => (list.length ? list.reduce((b, r) => (by(r) > by(b) ? r : b)) : null);
  const mostViewed = best(reels, (r) => r.views);
  const mostCommented = best(reels, (r) => r.commentsCount);
  const mostShared = best(
    reels.filter((r) => r.sharesCount != null),
    (r) => r.sharesCount ?? 0,
  );

  return (
    <div className="rounded-lg border border-[#F0F0F1] bg-white p-3 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:p-5">
      <div className="mb-2.5 flex items-baseline gap-3 md:mb-3.5">
        <span className="text-xl font-black tracking-[-0.02em] md:text-2xl">Insights</span>
        <span className="text-[13px] font-semibold text-[#4a4a48]">Across every reel in your Library</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="flex items-center gap-2.5 rounded-lg border border-[#F0F0F1] p-3 md:gap-3.5 md:p-4">
          <span className="flex size-8 flex-none items-center justify-center rounded-lg bg-[#FFF0F7] text-[#FF1F8F] md:size-10">
            <MaterialIcon name="stacks" size={21} weight={500} />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[32px] leading-none font-black tracking-[-0.03em]">{reels.length}</span>
            <span className="text-[13px] font-bold">Reels pulled</span>
          </div>
        </div>
        <Mini icon="visibility" label="Most viewed" reel={mostViewed} value={mostViewed ? fmtN(mostViewed.views) : "—"} />
        <Mini icon="chat_bubble" label="Most comments" reel={mostCommented} value={mostCommented ? fmtN(mostCommented.commentsCount) : "—"} />
        <Mini icon="send" label="Most shared" reel={mostShared} value={mostShared ? fmtN(mostShared.sharesCount ?? 0) : "—"} />
      </div>
    </div>
  );
}

function Mini({ icon, label, value, reel }: { icon: string; label: string; value: string; reel: InsightReel | null }) {
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
