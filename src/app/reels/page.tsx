import { createClient } from "@/lib/supabase/server";
import { AllReelsClient, type AllReelsRow } from "./all-reels-client";

export const dynamic = "force-dynamic";

export default async function AllReelsPage() {
  const supabase = await createClient();

  const { data: reels, error } = await supabase
    .from("ct_reels")
    .select(
      "id, url, caption, thumbnail_url, owner_username, posted_at, views, likes, comments_count, shares_count, transcription_status, ct_hooks(id), ct_framework_examples(id)",
    )
    .order("posted_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load reels: {error.message}
        </p>
      </div>
    );
  }

  const rows: AllReelsRow[] = (reels ?? []).map((r) => ({
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
    transcriptionStatus: r.transcription_status,
    hasHook: Array.isArray(r.ct_hooks) ? r.ct_hooks.length > 0 : Boolean(r.ct_hooks),
    hasFrameworkExample: Array.isArray(r.ct_framework_examples)
      ? r.ct_framework_examples.length > 0
      : Boolean(r.ct_framework_examples),
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">All Reels</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} reel{rows.length === 1 ? "" : "s"} pulled across all
          analyses
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reels yet — run an analysis first.
        </p>
      ) : (
        <AllReelsClient rows={rows} />
      )}
    </div>
  );
}
