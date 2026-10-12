import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { AnalyzeForm } from "./research-forms";
import type { QueueRow } from "./queue-client";
import { ResearchResults, type PulledReel } from "./research-results";

export const dynamic = "force-dynamic";
// analysis started from this page keeps running on the server after the page is left
export const maxDuration = 60;

export default async function ResearchPage() {
  const supabase = await createClient();

  const [{ data: reels, error }, { data: queueItems, error: queueError }, { data: batches }] = await Promise.all([
    supabase
      .from("ct_reels")
      .select(
        "id, url, caption, thumbnail_url, views, likes, comments_count, shares_count, reposts_count, saves_count, batch_id",
      )
      .order("posted_at", { ascending: false }),
    supabase
      .from("ct_reel_queue")
      .select(
        "id, url, status, caption, thumbnail_url, owner_username, posted_at, views, likes, comments_count, shares_count, reposts_count, saves_count, duration_seconds, error_message, created_at, analyzing_since, post_type",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("ct_research_batches")
      .select("id, kind, creator_username, creator_avatar_url, created_at")
      .eq("hidden_from_recent", false)
      .order("created_at", { ascending: false }),
  ]);

  const savedUrls = new Set((reels ?? []).map((r) => r.url as string));
  const staleIds = (queueItems ?? []).filter((r) => savedUrls.has(r.url as string)).map((r) => r.id as string);
  if (staleIds.length > 0) await supabase.from("ct_reel_queue").delete().in("id", staleIds);

  const queueRows: QueueRow[] = (queueItems ?? [])
    .filter((r) => !savedUrls.has(r.url as string))
    .map((r) => ({
    id: r.id,
    url: r.url,
    status: r.status as QueueRow["status"],
    caption: r.caption,
    thumbnailUrl: r.thumbnail_url,
    ownerUsername: r.owner_username,
    postedAt: r.posted_at,
    views: r.views,
    likes: r.likes,
    commentsCount: r.comments_count,
    sharesCount: r.shares_count,
    repostsCount: r.reposts_count,
    savesCount: r.saves_count,
    durationSeconds: r.duration_seconds,
    errorMessage: r.error_message,
    createdAt: r.created_at,
    postType: (r.post_type as string | null) ?? null,
    // being analyzed right now (started from any page or device)
    analyzing: r.analyzing_since != null && new Date(r.analyzing_since as string).getTime() > Date.now() - 15 * 60 * 1000,
  }));

  const rows: PulledReel[] = (reels ?? []).map((r) => ({
    id: r.id,
    caption: r.caption,
    views: r.views,
    commentsCount: r.comments_count,
    sharesCount: r.shares_count,
  }));

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] md:text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
          Analyze
          <span className="ml-1 inline-block size-2 md:size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        <p className="mt-1 text-[13.5px] md:mt-2 md:text-[15px] font-medium text-[#4a4a48]">
          See what&apos;s actually working.
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
      <ResearchResults queueRows={queueRows} />
    </PageShell>
  );
}
