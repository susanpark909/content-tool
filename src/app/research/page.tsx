import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { AnalyzeForm } from "./research-forms";
import type { QueueRow } from "./queue-client";
import { ResearchResults, type PulledReel } from "./research-results";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const supabase = await createClient();

  const [{ data: reels, error }, { data: queueItems, error: queueError }] = await Promise.all([
    supabase
      .from("ct_reels")
      .select(
        "id, url, caption, thumbnail_url, owner_username, posted_at, views, likes, comments_count, shares_count, transcription_status, ct_research_batches(kind)",
      )
      .order("posted_at", { ascending: false }),
    supabase
      .from("ct_reel_queue")
      .select(
        "id, url, status, caption, owner_username, posted_at, views, likes, comments_count, shares_count, duration_seconds, error_message, created_at",
      )
      .order("created_at", { ascending: false }),
  ]);

  const queueRows: QueueRow[] = (queueItems ?? []).map((r) => ({
    id: r.id,
    url: r.url,
    status: r.status as QueueRow["status"],
    caption: r.caption,
    ownerUsername: r.owner_username,
    postedAt: r.posted_at,
    views: r.views,
    likes: r.likes,
    commentsCount: r.comments_count,
    sharesCount: r.shares_count,
    durationSeconds: r.duration_seconds,
    errorMessage: r.error_message,
    createdAt: r.created_at,
  }));

  // Each reel is compared against its own creator's average, computed from
  // that creator's own pulled reels (most recent 30), not the whole table -
  // a single-reel pull shouldn't get diluted by, or skew, another
  // creator's numbers.
  const byOwner = new Map<string, { views: number; commentRate: number; shareRate: number[] }[]>();
  for (const r of reels ?? []) {
    if (!r.owner_username) continue;
    const list = byOwner.get(r.owner_username) ?? [];
    if (list.length < 30) {
      list.push({
        views: r.views,
        commentRate: r.views > 0 ? r.comments_count / r.views : 0,
        shareRate: r.views > 0 && r.shares_count != null ? [r.shares_count / r.views] : [],
      });
      byOwner.set(r.owner_username, list);
    }
  }
  const avgByOwner = new Map(
    [...byOwner.entries()].map(([owner, list]) => {
      const avgViews = list.reduce((s, x) => s + x.views, 0) / list.length;
      const avgCommentRate = list.reduce((s, x) => s + x.commentRate, 0) / list.length;
      const shareRates = list.flatMap((x) => x.shareRate);
      const avgShareRate = shareRates.length
        ? shareRates.reduce((s, x) => s + x, 0) / shareRates.length
        : 0;
      return [owner, { avgViews, avgCommentRate, avgShareRate }];
    }),
  );

  const rows: PulledReel[] = (reels ?? []).map((r) => {
    const commentRate = r.views > 0 ? r.comments_count / r.views : 0;
    const shareRate = r.views > 0 && r.shares_count != null ? r.shares_count / r.views : null;
    const avg = r.owner_username ? avgByOwner.get(r.owner_username) : null;
    const batch = Array.isArray(r.ct_research_batches)
      ? r.ct_research_batches[0]
      : r.ct_research_batches;
    return {
      id: r.id,
      url: r.url,
      caption: r.caption,
      thumbnailUrl: r.thumbnail_url,
      ownerUsername: r.owner_username,
      postedAt: r.posted_at,
      views: r.views,
      likes: r.likes,
      commentsCount: r.comments_count,
      sharesCount: r.shares_count,
      commentRate,
      shareRate,
      viewsMultiplier: avg && avg.avgViews > 0 ? r.views / avg.avgViews : null,
      commentRateMultiplier:
        avg && avg.avgCommentRate > 0 ? commentRate / avg.avgCommentRate : null,
      shareRateMultiplier:
        avg && avg.avgShareRate > 0 && shareRate != null ? shareRate / avg.avgShareRate : null,
      isSingle: batch?.kind === "single_reel",
      transcriptionStatus: r.transcription_status,
    };
  });

  return (
    <PageShell>
      <div>
        <h1 className="text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
          Analyze Reel
          <span className="ml-1 inline-block size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        <p className="mt-2 text-[15px] font-medium text-[#4a4a48]">
          Pull the numbers on a creator, or on one reel.
        </p>
      </div>

      <AnalyzeForm />

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load reels: {error.message}
        </p>
      )}
      {queueError && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load the queue: {queueError.message}
        </p>
      )}
      <ResearchResults rows={rows} queueRows={queueRows} />
    </PageShell>
  );
}
