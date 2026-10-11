import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";

export type InsightReel = { id: string; caption: string | null; views: number; commentsCount: number; sharesCount: number | null; postType?: string };

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
  return Math.round(n).toLocaleString("en-US");
}

// The average with the 2 highest and 2 lowest left out, so one viral hit (or a flop) doesn't skew it.
// With fewer than 5 reels there's nothing to spare, so it's the plain average.
function trimmedMean(values: number[], trim = 2): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const kept = sorted.length > trim * 2 ? sorted.slice(trim, sorted.length - trim) : sorted;
  return kept.reduce((s, v) => s + v, 0) / kept.length;
}

const AVG_TIP = "Average across your reels, leaving out the 2 highest and 2 lowest so one viral hit or flop doesn't skew it.";

// The headline numbers across every reel in the Library.
export function InsightsPanel({ reels }: { reels: InsightReel[] }) {
  const best = <T,>(list: T[], by: (x: T) => number) => (list.length ? list.reduce((b, r) => (by(r) > by(b) ? r : b)) : null);
  const mostViewed = best(reels, (r) => r.views);
  const mostCommented = best(reels, (r) => r.commentsCount);
  const mostShared = best(
    reels.filter((r) => r.sharesCount != null),
    (r) => r.sharesCount ?? 0,
  );

  // averages only count reels (carousels have no views); shares only count reels that show them
  const justReels = reels.filter((r) => (r.postType ?? "reel") === "reel");
  const avgViews = trimmedMean(justReels.map((r) => r.views));
  const avgComments = trimmedMean(justReels.map((r) => r.commentsCount));
  const avgShares = trimmedMean(justReels.filter((r) => r.sharesCount != null).map((r) => r.sharesCount as number));

  return (
    <div className="rounded-lg border border-[#F0F0F1] bg-white p-2.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:p-4">
      <div className="mb-2 flex items-baseline gap-2.5 md:mb-3">
        <span className="text-lg font-black tracking-[-0.02em] md:text-xl">Insights</span>
        <span className="text-[12px] font-semibold text-[#4a4a48] max-md:hidden">Across every reel in your Library</span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat icon="stacks" label="Reels Pulled" value={String(reels.length)} />
        <Stat icon="visibility" label="Avg Views" value={avgViews != null ? fmtN(avgViews) : "—"} tip={AVG_TIP} />
        <Stat icon="comment" label="Avg Comments" value={avgComments != null ? fmtN(avgComments) : "—"} tip={AVG_TIP} />
        <Stat icon="send" label="Avg Shares" value={avgShares != null ? fmtN(avgShares) : "—"} tip={AVG_TIP} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 md:mt-3 md:gap-3">
        <Top icon="visibility" label="Most Viewed" reel={mostViewed} value={mostViewed ? fmtN(mostViewed.views) : "—"} />
        <Top icon="comment" label="Most Comments" reel={mostCommented} value={mostCommented ? fmtN(mostCommented.commentsCount) : "—"} />
        <Top icon="send" label="Most Shared" reel={mostShared} value={mostShared ? fmtN(mostShared.sharesCount ?? 0) : "—"} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tip }: { icon: string; label: string; value: string; tip?: string }) {
  return (
    <div title={tip} className="flex min-w-0 items-center gap-2.5 rounded-lg border border-[#F0F0F1] px-2.5 py-2 md:px-3.5 md:py-2.5">
      <span className="flex size-7 flex-none items-center justify-center rounded-md bg-[#FFF0F7] text-[#FF1F8F] max-md:hidden md:size-8">
        <MaterialIcon name={icon} size={18} weight={500} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[11px] font-bold text-[#6b6b69] md:text-xs">{label}</span>
        <span className="text-[20px] leading-[1.1] font-black tracking-[-0.02em] md:text-[24px]">{value}</span>
      </div>
    </div>
  );
}

function Top({ icon, label, value, reel }: { icon: string; label: string; value: string; reel: InsightReel | null }) {
  return (
    <Link
      href={reel ? `/analyze-reel/reel/${reel.id}` : "#"}
      prefetch={false}
      className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-[#F0F0F1] px-2.5 py-2 hover:border-[#FF1F8F] md:flex-row md:items-center md:gap-2.5 md:px-3.5 md:py-2"
    >
      <span className="flex size-7 flex-none items-center justify-center rounded-md bg-[#FFF0F7] text-[#FF1F8F] max-md:hidden md:size-8">
        <MaterialIcon name={icon} size={18} weight={500} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col md:gap-0.5">
        <span className="flex flex-col md:flex-row md:items-baseline md:gap-2">
          <span className="truncate text-[11px] font-bold text-[#6b6b69] md:text-xs">{label}</span>
          <span className="text-[20px] leading-[1.1] font-black tracking-[-0.02em] md:text-[18px]">{value}</span>
        </span>
        <span className="truncate text-[11px] font-semibold text-[#4a4a48] md:text-xs md:text-[#0D0D0D]">{reel?.caption || "No reels yet"}</span>
      </div>
    </Link>
  );
}
