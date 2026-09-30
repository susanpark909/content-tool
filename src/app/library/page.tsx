import { createClient } from "@/lib/supabase/server";
import { LibraryTabs } from "./library-tabs";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await createClient();

  const { data: savedReels, error: savedReelsError } = await supabase
    .from("ct_reels")
    .select(
      "id, url, owner_username, owner_avatar_url, thumbnail_url, hook_text, body_text, cta_text, caption, views, likes, comments_count, shares_count",
    )
    .not("hook_text", "is", null)
    .order("views", { ascending: false });

  if (savedReelsError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load the Library: {savedReelsError.message}
        </p>
      </div>
    );
  }

  const savedReelRows = (savedReels ?? []).map((r) => ({
    id: r.id,
    url: r.url,
    ownerUsername: r.owner_username,
    ownerAvatarUrl: r.owner_avatar_url,
    thumbnailUrl: r.thumbnail_url,
    hookText: r.hook_text,
    bodyText: r.body_text,
    ctaText: r.cta_text,
    caption: r.caption,
    views: r.views,
    likes: r.likes,
    commentsCount: r.comments_count,
    sharesCount: r.shares_count,
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-sm text-muted-foreground">
          Every hook and script saved automatically when a reel is
          transcribed, with its stats.
        </p>
      </div>

      <LibraryTabs savedReelRows={savedReelRows} />
    </div>
  );
}
