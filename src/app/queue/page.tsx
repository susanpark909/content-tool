import { createClient } from "@/lib/supabase/server";
import { QueueClient, type QueueRow } from "./queue-client";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("ct_reel_queue")
    .select(
      "id, url, status, caption, owner_username, posted_at, views, likes, comments_count, shares_count, duration_seconds, error_message, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load the queue: {error.message}
        </p>
      </div>
    );
  }

  const rows: QueueRow[] = (items ?? []).map((r) => ({
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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Queue</h1>
        <p className="text-sm text-muted-foreground">
          Reels shared in from your phone. Each one is analyzed automatically
          — remove it or send it to your reel library.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing queued yet — share a reel in from your phone and it&apos;ll
          show up here.
        </p>
      ) : (
        <QueueClient rows={rows} />
      )}
    </div>
  );
}
