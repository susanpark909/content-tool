import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { fmtRate } from "@/lib/rates";
import { fmtN } from "@/lib/format";

export type InsightReel = { id: string; caption: string | null; views: number; likes?: number; commentsCount: number; sharesCount?: number | null; postType?: string };

// The average with the 2 highest and 2 lowest left out, so one viral hit (or a flop) doesn't skew it.
// With fewer than 5 reels there's nothing to spare, so it's the plain average.
function trimmedMean(values: number[], trim = 2): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const kept = sorted.length > trim * 2 ? sorted.slice(trim, sorted.length - trim) : sorted;
  return kept.reduce((s, v) => s + v, 0) / kept.length;
}

const AVG_TIP = "Average across your reels, leaving out the 2 highest and 2 lowest so one viral hit or flop doesn't skew it.";

// The first sentence of a caption: a complete thought, never cut off with dots.
function firstSentence(caption: string | null | undefined) {
  const firstLine = (caption || "").split("\n")[0].trim();
  let out = (firstLine.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? firstLine).trim();
  if (out.length > 120) out = out.slice(0, out.lastIndexOf(" ", 120) > 60 ? out.lastIndexOf(" ", 120) : 120).trim();
  return out || "No reels yet";
}

// The headline numbers across every reel in the Library.
export function InsightsPanel({ reels }: { reels: InsightReel[] }) {
  const best = <T,>(list: T[], by: (x: T) => number) => (list.length ? list.reduce((b, r) => (by(r) > by(b) ? r : b)) : null);
  const mostViewed = best(reels, (r) => r.views);
  const mostCommented = best(reels, (r) => r.commentsCount);
  const withShares = reels.filter((r) => r.sharesCount != null);
  const mostShared = best(withShares, (r) => r.sharesCount ?? 0);

  // averages only count reels (carousels have no views)
  const justReels = reels.filter((r) => (r.postType ?? "reel") === "reel");
  const avgViews = trimmedMean(justReels.map((r) => r.views));
  const avgComments = trimmedMean(justReels.map((r) => r.commentsCount));
  const avgShares = trimmedMean(justReels.filter((r) => r.sharesCount != null).map((r) => r.sharesCount ?? 0));
  const avgRate = trimmedMean(justReels.filter((r) => r.views > 0).map((r) => r.commentsCount / r.views));
  const f = (n: number | null) => (n != null ? fmtN(n) : "—");

  const topViews = mostViewed ? fmtN(mostViewed.views) : "—";
  const topComments = mostCommented ? fmtN(mostCommented.commentsCount) : "—";
  const topShares = mostShared ? fmtN(mostShared.sharesCount ?? 0) : "—";

  return (
    <div className="rounded-lg border border-[#F0F0F1] bg-white p-2.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:p-4">
      {/* phones: one compact block, two rows of four, every cell the same size */}
      <div className="md:hidden">
        <div className="mb-1.5 text-[15px] font-black tracking-[-0.02em]">Insights</div>
        <div className="grid grid-cols-4 divide-x divide-[#F0F0F1] overflow-hidden rounded-lg border border-[#F0F0F1]">
          <Cell label="Avg Views" value={f(avgViews)} tip={AVG_TIP} />
          <Cell label="Avg Comments" value={f(avgComments)} tip={AVG_TIP} />
          <Cell label="Avg Shares" value={f(avgShares)} tip={AVG_TIP} />
          <Cell label="Engagement Rate" value={fmtRate(avgRate)} tip="Comments divided by views, averaged across your reels." />
        </div>
        <div className="mt-1.5 grid grid-cols-4 divide-x divide-[#F0F0F1] overflow-hidden rounded-lg border border-[#F0F0F1]">
          <Cell label="Reels" value={String(reels.length)} />
          <Cell label="Top Views" value={topViews} href={mostViewed ? `/analyze-reel/reel/${mostViewed.id}` : undefined} tip={firstSentence(mostViewed?.caption)} />
          <Cell label="Top Comments" value={topComments} href={mostCommented ? `/analyze-reel/reel/${mostCommented.id}` : undefined} tip={firstSentence(mostCommented?.caption)} />
          <Cell label="Top Shares" value={topShares} href={mostShared ? `/analyze-reel/reel/${mostShared.id}` : undefined} tip={firstSentence(mostShared?.caption)} />
        </div>
      </div>

      {/* larger screens: the full version */}
      <div className="max-md:hidden">
        <div className="mb-3 flex items-baseline gap-2.5">
          <span className="text-xl font-black tracking-[-0.02em]">Insights</span>
          <span className="text-[12px] font-semibold text-[#4a4a48]">Across every reel in your Library</span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          <Stat icon="stacks" label="Reels Pulled" value={String(reels.length)} />
          <Stat icon="visibility" label="Avg Views" value={f(avgViews)} tip={AVG_TIP} />
          <Stat icon="comment" label="Avg Comments" value={f(avgComments)} tip={AVG_TIP} />
          <Stat icon="send" label="Avg Shares" value={f(avgShares)} tip={AVG_TIP} />
          <Stat icon="bolt" label="Engagement Rate" value={fmtRate(avgRate)} tip="Comments divided by views, averaged across your reels." />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Top icon="visibility" label="Most Viewed" reel={mostViewed} value={topViews} />
          <Top icon="comment" label="Most Comments" reel={mostCommented} value={topComments} />
          <Top icon="send" label="Most Shares" reel={mostShared} value={topShares} />
        </div>
      </div>
    </div>
  );
}

// One small cell: the label on top, the number under it, centered. Tap a "Top" cell to open that reel.
function Cell({ label, value, tip, href }: { label: string; value: string; tip?: string; href?: string }) {
  const inner = (
    <>
      <span className="text-[10px] leading-tight font-bold text-[#6b6b69]">{label}</span>
      <span className="text-[16px] leading-tight font-black tracking-[-0.02em] whitespace-nowrap [font-variant-numeric:tabular-nums]">{value}</span>
    </>
  );
  const cls = "flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center";
  return href ? (
    <Link href={href} prefetch={false} title={tip} className={`${cls} hover:bg-[#FFF8FB]`}>
      {inner}
    </Link>
  ) : (
    <div title={tip} className={cls}>
      {inner}
    </div>
  );
}

function Stat({ icon, label, value, tip }: { icon: string; label: string; value: string; tip?: string }) {
  return (
    <div title={tip} className="flex min-w-0 items-center gap-2.5 rounded-lg border border-[#F0F0F1] px-3.5 py-2.5">
      <span className="flex size-8 flex-none items-center justify-center rounded-md bg-[#FFF0F7] text-[#FF1F8F]">
        <MaterialIcon name={icon} size={18} weight={500} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-bold text-[#6b6b69]">{label}</span>
        <span className="text-[24px] leading-[1.1] font-black tracking-[-0.02em] whitespace-nowrap [font-variant-numeric:tabular-nums]">{value}</span>
      </div>
    </div>
  );
}

function Top({ icon, label, value, reel }: { icon: string; label: string; value: string; reel: InsightReel | null }) {
  return (
    <Link
      href={reel ? `/analyze-reel/reel/${reel.id}` : "#"}
      prefetch={false}
      className="flex min-w-0 items-center gap-2.5 rounded-lg border border-[#F0F0F1] px-3.5 py-2 hover:border-[#FF1F8F]"
    >
      <span className="flex size-8 flex-none items-center justify-center rounded-md bg-[#FFF0F7] text-[#FF1F8F]">
        <MaterialIcon name={icon} size={18} weight={500} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-[#6b6b69]">{label}</span>
          <span className="text-[18px] leading-[1.1] font-black tracking-[-0.02em]">{value}</span>
        </span>
        <span className="text-xs font-semibold break-words">{firstSentence(reel?.caption)}</span>
      </div>
    </Link>
  );
}
