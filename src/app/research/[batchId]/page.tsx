import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreatorResultsTable, type ReelRow } from "./creator-results-table";

function instagramProfileUrl(username: string | null, fallback: string) {
  if (username) return `https://instagram.com/${username}`;
  return fallback;
}

export const dynamic = "force-dynamic";

export default async function CreatorResultsPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("ct_research_batches")
    .select("id, kind, input_value, creator_username, created_at")
    .eq("id", batchId)
    .single();

  if (!batch) notFound();

  const { data: reels, error } = await supabase
    .from("ct_reels")
    .select(
      "id, url, caption, thumbnail_url, posted_at, views, likes, comments_count, shares_count",
    )
    .eq("batch_id", batchId)
    .order("posted_at", { ascending: false });

  const count = reels?.length ?? 0;
  const avgViews = count
    ? (reels ?? []).reduce((sum, r) => sum + r.views, 0) / count
    : 0;
  const avgCommentRate = count
    ? (reels ?? []).reduce(
        (sum, r) => sum + (r.views > 0 ? r.comments_count / r.views : 0),
        0,
      ) / count
    : 0;

  const rows: ReelRow[] = (reels ?? []).map((r) => {
    const commentRate = r.views > 0 ? r.comments_count / r.views : 0;
    return {
      id: r.id,
      url: r.url,
      caption: r.caption,
      thumbnailUrl: r.thumbnail_url,
      postedAt: r.posted_at,
      views: r.views,
      likes: r.likes,
      commentsCount: r.comments_count,
      commentRate,
      viewsMultiplier: avgViews > 0 ? r.views / avgViews : 0,
      commentRateMultiplier:
        avgCommentRate > 0 ? commentRate / avgCommentRate : 0,
    };
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">
          <a
            href={instagramProfileUrl(batch.creator_username, batch.input_value)}
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            {batch.creator_username
              ? `@${batch.creator_username}`
              : batch.input_value}
          </a>
        </h1>
        <p className="text-sm text-muted-foreground">
          {count} reel{count === 1 ? "" : "s"} · avg{" "}
          {Math.round(avgViews).toLocaleString()} views · avg{" "}
          {(avgCommentRate * 100).toFixed(2)}% comment rate
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load reels: {error.message}
        </p>
      )}
      {!error && count === 0 && (
        <p className="text-sm text-muted-foreground">
          No reels found for this batch.
        </p>
      )}
      {!error && count > 0 && <CreatorResultsTable reels={rows} />}
    </div>
  );
}
