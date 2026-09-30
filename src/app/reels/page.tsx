import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { AllReelsClient, type AllReelsRow } from "./all-reels-client";

export const dynamic = "force-dynamic";

export default async function AllReelsPage() {
  const supabase = await createClient();

  const { data: reels, error } = await supabase
    .from("ct_reels")
    .select(
      "id, url, caption, thumbnail_url, owner_username, owner_avatar_url, posted_at, created_at, views, likes, comments_count, shares_count, duration_seconds, transcription_status, goal, ct_research_batches(kind)",
    )
    .order("posted_at", { ascending: false });

  const rows: AllReelsRow[] = (reels ?? []).map((r) => {
    const batch = Array.isArray(r.ct_research_batches)
      ? r.ct_research_batches[0]
      : r.ct_research_batches;
    return {
      id: r.id,
      url: r.url,
      caption: r.caption,
      thumbnailUrl: r.thumbnail_url,
      ownerUsername: r.owner_username,
      ownerAvatarUrl: r.owner_avatar_url,
      postedAt: r.posted_at,
      analyzedAt: r.created_at,
      views: r.views,
      likes: r.likes,
      commentsCount: r.comments_count,
      sharesCount: r.shares_count,
      durationSeconds: r.duration_seconds,
      transcriptionStatus: r.transcription_status,
      goal: r.goal as AllReelsRow["goal"],
      isSingle: batch?.kind === "single_reel",
    };
  });

  return (
    <PageShell>
      <div>
        <h1 className="text-[64px] leading-[0.95] font-black tracking-[-0.04em] capitalize">
          All Reels
          <span className="ml-1 inline-block size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        <p className="mt-2 text-[15px] font-medium text-[#4a4a48]">
          Every reel you&apos;ve pulled in from the creators you research.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load reels: {error.message}
        </p>
      )}
      <AllReelsClient rows={rows} />
    </PageShell>
  );
}
