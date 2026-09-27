import { createClient } from "@/lib/supabase/server";
import { LibraryTabs } from "./library-tabs";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await createClient();

  const [
    { data: hooks, error: hooksError },
    { data: hookPatterns },
    { data: frameworks, error: fwError },
    { data: examples, error: exError },
  ] = await Promise.all([
    supabase
      .from("ct_hooks")
      .select(
        "id, hook_text, pattern_id, emotional_mechanism, cta_used, why_it_worked, created_at, ct_hook_patterns(name), ct_reels(id, url, owner_username, thumbnail_url, views, likes, comments_count, shares_count)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("ct_hook_patterns").select("id, name").order("created_at"),
    supabase
      .from("ct_frameworks")
      .select("id, name, description, created_at")
      .order("created_at"),
    supabase
      .from("ct_framework_examples")
      .select(
        "id, framework_id, note, ct_reels(id, url, owner_username, thumbnail_url, caption, views, likes, comments_count)",
      )
      .order("created_at", { ascending: false }),
  ]);

  if (hooksError || fwError || exError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load the Library:{" "}
          {hooksError?.message ?? fwError?.message ?? exError?.message}
        </p>
      </div>
    );
  }

  const hookRows = (hooks ?? []).map((h) => {
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
      sharesCount: reel?.shares_count ?? null,
    };
  });

  const frameworkRows = (frameworks ?? []).map((f) => {
    const fwExamples = (examples ?? [])
      .filter((e) => e.framework_id === f.id)
      .map((e) => {
        const reel = Array.isArray(e.ct_reels) ? e.ct_reels[0] : e.ct_reels;
        return {
          id: e.id,
          note: e.note,
          reelId: reel?.id ?? null,
          reelUrl: reel?.url ?? null,
          ownerUsername: reel?.owner_username ?? null,
          thumbnailUrl: reel?.thumbnail_url ?? null,
          caption: reel?.caption ?? null,
          views: reel?.views ?? null,
          likes: reel?.likes ?? null,
          commentsCount: reel?.comments_count ?? null,
        };
      });

    return {
      id: f.id,
      name: f.name,
      description: f.description,
      examples: fwExamples,
    };
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Frameworks</h1>
        <p className="text-sm text-muted-foreground">
          Saved hooks and body examples from your analyses.
        </p>
      </div>

      <LibraryTabs
        hookRows={hookRows}
        hookPatterns={hookPatterns ?? []}
        frameworkRows={frameworkRows}
      />
    </div>
  );
}
