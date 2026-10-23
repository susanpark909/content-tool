import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { AnalyzeForm } from "./research-forms";
import type { QueueRow } from "./queue-client";
import { ResearchResults } from "./research-results";
import { AnalysisStatus, type AnalysisLinkRow } from "./analysis-status";

export const dynamic = "force-dynamic";
// analysis started from this page keeps running on the server after the page is left
export const maxDuration = 300;

export default async function ResearchPage() {
  const supabase = await createClient();

  // This page refreshes itself while things are being analyzed, so it only asks for what it shows: the queue.
  const { data: queueItems, error: queueError } = await supabase
    .from("ct_reel_queue")
    .select(
      "id, url, status, caption, thumbnail_url, owner_username, posted_at, views, likes, comments_count, shares_count, reposts_count, saves_count, duration_seconds, error_message, created_at, analyzing_since, post_type",
    )
    .order("created_at", { ascending: false });

  // queue items that are already in the Library are dropped from the queue
  const queueUrls = (queueItems ?? []).map((r) => r.url as string);
  const savedUrls = new Set<string>();
  for (let i = 0; i < queueUrls.length; i += 100) {
    const { data: saved } = await supabase.from("ct_reels").select("url").in("url", queueUrls.slice(i, i + 100));
    (saved ?? []).forEach((r) => savedUrls.add(r.url as string));
  }
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

  // links sent for analysis: still working, failed (kept until dismissed), or just finished
  const { data: linkRows } = await supabase
    .from("ct_analysis_links")
    .select("id, url, status, note, finished_at")
    .gt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(40);
  const recentCutoff = Date.now() - 3 * 60 * 1000;
  const analysisRows: AnalysisLinkRow[] = (linkRows ?? [])
    .filter((r) => r.status !== "done" || (r.finished_at != null && new Date(r.finished_at as string).getTime() > recentCutoff))
    .map((r) => ({ id: r.id as string, url: r.url as string, status: r.status as AnalysisLinkRow["status"], note: (r.note as string | null) ?? null }));

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

      <AnalysisStatus rows={analysisRows} />

      {queueError && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load the queue: {queueError.message}
        </p>
      )}
      <ResearchResults queueRows={queueRows} />
    </PageShell>
  );
}
