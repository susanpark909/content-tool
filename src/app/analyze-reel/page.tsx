import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { AnalyzeForm } from "./research-forms";
import type { QueueRow } from "./queue-client";
import { ResearchResults, type PulledReel, type RecentPull } from "./research-results";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const supabase = await createClient();

  const [{ data: reels, error }, { data: queueItems, error: queueError }, { data: batches }] = await Promise.all([
    supabase
      .from("ct_reels")
      .select(
        "id, caption, views, likes, comments_count, shares_count, batch_id",
      )
      .order("posted_at", { ascending: false }),
    supabase
      .from("ct_reel_queue")
      .select(
        "id, url, status, caption, owner_username, posted_at, views, likes, comments_count, shares_count, duration_seconds, error_message, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("ct_research_batches")
      .select("id, kind, creator_username, created_at")
      .eq("hidden_from_recent", false)
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

  const rows: PulledReel[] = (reels ?? []).map((r) => ({
    id: r.id,
    caption: r.caption,
    views: r.views,
    commentsCount: r.comments_count,
    sharesCount: r.shares_count,
  }));

  // Recent Pulls: batches from the last 7 days that haven't been removed from
  // the list. Numbers are averages per reel (a single reel is just itself).
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const byBatch = new Map<string, NonNullable<typeof reels>>();
  for (const r of reels ?? []) {
    if (!r.batch_id) continue;
    const list = byBatch.get(r.batch_id) ?? [];
    list.push(r);
    byBatch.set(r.batch_id, list);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const pulls: RecentPull[] = (batches ?? [])
    .map((b) => {
      const list = byBatch.get(b.id) ?? [];
      const shares = list.map((r) => r.shares_count).filter((n): n is number => n != null);
      return {
        id: b.id,
        isProfile: b.kind === "profile",
        name:
          b.kind === "profile"
            ? `@${b.creator_username ?? "unknown"}`
            : list.length === 1
              ? list[0].caption || "(no caption)"
              : `${list.length} reels`,
        reelCount: list.length,
        createdAt: b.created_at,
        views: avg(list.map((r) => r.views)) ?? 0,
        likes: avg(list.map((r) => r.likes)) ?? 0,
        comments: avg(list.map((r) => r.comments_count)) ?? 0,
        shares: avg(shares),
      };
    })
    .filter((p) => p.reelCount > 0 && new Date(p.createdAt).getTime() >= cutoff);

  return (
    <PageShell>
      <div>
        <h1 className="text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
          Analyze Reel
          <span className="ml-1 inline-block size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        <p className="mt-2 text-[15px] font-medium text-[#4a4a48]">
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
      <ResearchResults rows={rows} queueRows={queueRows} pulls={pulls} />
    </PageShell>
  );
}
