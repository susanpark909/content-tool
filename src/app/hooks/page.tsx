import { createClient } from "@/lib/supabase/server";
import { HookLibraryClient } from "./hook-library-client";

export const dynamic = "force-dynamic";

export default async function HookLibraryPage() {
  const supabase = await createClient();

  const [{ data: hooks, error }, { data: hookPatterns }] = await Promise.all([
    supabase
      .from("ct_hooks")
      .select(
        "id, hook_text, pattern_id, emotional_mechanism, cta_used, why_it_worked, created_at, ct_hook_patterns(name), ct_reels(id, url, owner_username, thumbnail_url, views, likes, comments_count)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("ct_hook_patterns").select("id, name").order("created_at"),
  ]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load the Hook Library: {error.message}
        </p>
      </div>
    );
  }

  const rows = (hooks ?? []).map((h) => {
    const pattern = Array.isArray(h.ct_hook_patterns)
      ? h.ct_hook_patterns[0]
      : h.ct_hook_patterns;
    const reel = Array.isArray(h.ct_reels) ? h.ct_reels[0] : h.ct_reels;
    return {
      id: h.id,
      hookText: h.hook_text,
      patternId: h.pattern_id,
      patternName: pattern?.name ?? null,
      emotionalMechanism: h.emotional_mechanism,
      ctaUsed: h.cta_used,
      whyItWorked: h.why_it_worked,
      reelId: reel?.id ?? null,
      reelUrl: reel?.url ?? null,
      ownerUsername: reel?.owner_username ?? null,
      thumbnailUrl: reel?.thumbnail_url ?? null,
      views: reel?.views ?? null,
      likes: reel?.likes ?? null,
      commentsCount: reel?.comments_count ?? null,
    };
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Hook Library</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} saved hook{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      <HookLibraryClient rows={rows} hookPatterns={hookPatterns ?? []} />
    </div>
  );
}
