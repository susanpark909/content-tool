import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FrameworkLibraryClient } from "./framework-library-client";

export const dynamic = "force-dynamic";

export default async function FrameworkLibraryPage() {
  const supabase = await createClient();

  const [{ data: frameworks, error: fwError }, { data: examples, error: exError }] =
    await Promise.all([
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

  if (fwError || exError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load the Framework Library:{" "}
          {fwError?.message ?? exError?.message}
        </p>
      </div>
    );
  }

  const rows = (frameworks ?? []).map((f) => {
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
        <h1 className="text-2xl font-semibold">Framework Library</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} framework{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No frameworks yet. Add some from the{" "}
          <Link href="/research" className="underline">
            Reel Detail page
          </Link>
          .
        </p>
      ) : (
        <FrameworkLibraryClient frameworks={rows} />
      )}
    </div>
  );
}
