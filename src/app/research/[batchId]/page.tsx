import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { MaterialIcon } from "@/components/ui/material-icon";
import { CreatorResultsTable, type ReelRow } from "./creator-results-table";
import { DismissibleWarning } from "../dismissible-warning";

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
  return Math.round(n).toLocaleString("en-US");
}

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
      shareRateMultiplier:
        avgShareRate > 0 && shareRate != null ? shareRate / avgShareRate : null,
      transcriptionStatus: r.transcription_status,
    };
  });

  const mostViewed = rows.length
    ? rows.reduce((best, r) => (r.views > best.views ? r : best))
    : null;
  const mostCommented = rows.length
    ? rows.reduce((best, r) => (r.commentsCount > best.commentsCount ? r : best))
    : null;
  const shareableRows = rows.filter((r) => r.sharesCount != null);
  const mostShared = shareableRows.length
    ? shareableRows.reduce((best, r) => ((r.sharesCount ?? 0) > (best.sharesCount ?? 0) ? r : best))
    : null;

  return (
    <PageShell>
      <div>
          <h1 className="text-[40px] leading-[0.95] font-black tracking-[-0.03em]">
            <a
              href={instagramProfileUrl(batch.creator_username, batch.input_value)}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#FF1F8F]"
            >
              {batch.creator_username
                ? `@${batch.creator_username}`
                : batch.input_value}
            </a>
          </h1>
          <p className="mt-2 text-sm font-medium text-[#4a4a48]">
            {count}
            {batch.results_limit != null ? ` of ${batch.results_limit}` : ""}{" "}
            reel{count === 1 ? "" : "s"} · avg{" "}
            {Math.round(avgViews).toLocaleString()} views · avg{" "}
            {(avgCommentRate * 100).toFixed(2)}% comment rate
            {avgShareRate > 0 && (
              <> · avg {(avgShareRate * 100).toFixed(2)}% share rate</>
            )}
          </p>
        <p className="text-xs font-medium text-[#4a4a48]">
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

      {count > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3.5 rounded-lg border border-[#F0F0F1] bg-white p-4">
            <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-[#FFF0F7] text-[#FF1F8F]">
              <MaterialIcon name="stacks" size={21} weight={500} />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[32px] leading-none font-black tracking-[-0.03em]">
                {count}
              </span>
              <span className="text-[13px] font-bold">Reels pulled</span>
            </div>
          </div>
          {mostViewed && (
            <InsightCard
              icon="visibility"
              label="Most viewed"
              value={fmtN(mostViewed.views)}
              caption={mostViewed.caption}
              href={`/research/reel/${mostViewed.id}`}
            />
          )}
          {mostCommented && (
            <InsightCard
              icon="chat_bubble"
              label="Most comments"
              value={fmtN(mostCommented.commentsCount)}
              caption={mostCommented.caption}
              href={`/research/reel/${mostCommented.id}`}
            />
          )}
          {mostShared && (
            <InsightCard
              icon="send"
              label="Most shared"
              value={fmtN(mostShared.sharesCount ?? 0)}
              caption={mostShared.caption}
              href={`/research/reel/${mostShared.id}`}
            />
          )}
        </div>
      )}

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
    </PageShell>
  );
}

function InsightCard({
  icon,
  label,
  value,
  caption,
  href,
}: {
  icon: string;
  label: string;
  value: string;
  caption: string | null;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex min-w-0 items-center gap-3.5 rounded-lg border border-[#F0F0F1] bg-white p-4 hover:border-[#FF1F8F]"
    >
      <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-[#FFF0F7] text-[#FF1F8F]">
        <MaterialIcon name={icon} size={21} weight={500} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-bold text-[#4a4a48]">{label}</span>
        <span className="text-2xl leading-[1.05] font-black tracking-[-0.02em]">{value}</span>
        <span className="truncate text-[13px] font-semibold">{caption || "(no caption)"}</span>
      </div>
    </a>
  );
}
