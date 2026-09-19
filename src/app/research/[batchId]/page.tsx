import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreatorResultsTable, type ReelRow } from "./creator-results-table";
import { DismissibleWarning } from "../dismissible-warning";

function instagramProfileUrl(username: string | null, fallback: string) {
  if (username) return `https://instagram.com/${username}`;
  return fallback;
}

function formatDateOnly(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
    .select(
      "id, kind, input_value, creator_username, creator_avatar_url, created_at, date_from, date_to, results_limit, raw_fetch_count, earliest_fetched_at, dismissed_incomplete_warning, dismissed_window_warning",
    )
    .eq("id", batchId)
    .single();

  if (!batch) notFound();

  const MAX_RESULTS_LIMIT = 500;
  const hasDateRange = Boolean(batch.date_from || batch.date_to);
  const windowMayBeIncomplete =
    hasDateRange &&
    batch.date_from != null &&
    batch.earliest_fetched_at != null &&
    batch.raw_fetch_count != null &&
    batch.raw_fetch_count >= MAX_RESULTS_LIMIT &&
    batch.earliest_fetched_at > `${batch.date_from}T00:00:00`;

  const { data: reels, error } = await supabase
    .from("ct_reels")
    .select(
      "id, url, caption, thumbnail_url, posted_at, views, likes, comments_count, shares_count, transcription_status",
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
  const avgShareRate = count
    ? (reels ?? []).reduce(
        (sum, r) =>
          sum + (r.views > 0 && r.shares_count != null ? r.shares_count / r.views : 0),
        0,
      ) / count
    : 0;

  const rows: ReelRow[] = (reels ?? []).map((r) => {
    const commentRate = r.views > 0 ? r.comments_count / r.views : 0;
    const shareRate =
      r.views > 0 && r.shares_count != null ? r.shares_count / r.views : null;
    return {
      id: r.id,
      url: r.url,
      caption: r.caption,
      thumbnailUrl: r.thumbnail_url,
      postedAt: r.posted_at,
      views: r.views,
      likes: r.likes,
      commentsCount: r.comments_count,
      sharesCount: r.shares_count,
      commentRate,
      shareRate,
      viewsMultiplier: avgViews > 0 ? r.views / avgViews : 0,
      commentRateMultiplier:
        avgCommentRate > 0 ? commentRate / avgCommentRate : 0,
      transcriptionStatus: r.transcription_status,
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
            {count}
            {batch.results_limit != null ? ` of ${batch.results_limit}` : ""}{" "}
            reel{count === 1 ? "" : "s"} · avg{" "}
            {Math.round(avgViews).toLocaleString()} views · avg{" "}
            {(avgCommentRate * 100).toFixed(2)}% comment rate
            {avgShareRate > 0 && (
              <> · avg {(avgShareRate * 100).toFixed(2)}% share rate</>
            )}
          </p>
        <p className="text-xs text-muted-foreground">
          Pulled {formatTimestamp(batch.created_at)}
          {(batch.date_from || batch.date_to) && (
            <>
              {" "}
              · window: {formatDateOnly(batch.date_from) ?? "any"} to{" "}
              {formatDateOnly(batch.date_to) ?? "now"}
            </>
          )}
        </p>
        {batch.kind === "profile" &&
          !hasDateRange &&
          batch.results_limit != null &&
          count < batch.results_limit &&
          !batch.dismissed_incomplete_warning && (
            <DismissibleWarning batchId={batch.id} field="incomplete">
              Incomplete pull — Instagram likely blocked part of this
              request. This may not be the true top {batch.results_limit}{" "}
              reels; consider re-running.
            </DismissibleWarning>
          )}
        {windowMayBeIncomplete && !batch.dismissed_window_warning && (
          <DismissibleWarning batchId={batch.id} field="window">
            Window may be incomplete — the search reached back to{" "}
            {formatDateOnly(batch.earliest_fetched_at)} but your window
            starts {formatDateOnly(batch.date_from)}. This creator may have
            more reels earlier in your range that weren&apos;t reached;
            narrow the date range if you need everything covered.
          </DismissibleWarning>
        )}
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
      {!error && count > 0 && <CreatorResultsTable reels={rows} batchId={batchId} />}
    </div>
  );
}
