import { notFound } from "next/navigation";
import { isNoAudioError } from "@/lib/transcription-state";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { BackLink } from "@/components/back-link";
import { ReelDetailClient } from "./reel-detail-client";
import { loadTypes } from "@/lib/content-types-server";

export const dynamic = "force-dynamic";

export default async function ReelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reelId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { reelId } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();

  const { data: reel } = await supabase
    .from("ct_reels")
    .select(
      "id, batch_id, url, caption, thumbnail_url, owner_username, owner_avatar_url, posted_at, views, likes, comments_count, shares_count, reposts_count, saves_count, duration_seconds, transcript, transcription_status, transcription_error, hook_text, body_text, cta_text, goals, post_type, slides, analyzing_since",
    )
    .eq("id", reelId)
    .single();

  if (!reel) notFound();

  let avg: {
    views: number;
    likes: number;
    comments: number;
    shares: number | null;
    reposts: number | null;
    saves: number | null;
  } | null = null;
  if (reel.owner_username) {
    const { data: others } = await supabase
      .from("ct_reels")
      .select("views, likes, comments_count, shares_count, reposts_count, saves_count")
      .eq("owner_username", reel.owner_username)
      .order("posted_at", { ascending: false })
      .limit(30);
    if (others && others.length > 0) {
      const avgViews = others.reduce((s, r) => s + r.views, 0) / others.length;
      const avgLikes = others.reduce((s, r) => s + r.likes, 0) / others.length;
      const avgComments = others.reduce((s, r) => s + r.comments_count, 0) / others.length;
      const shareVals = others.map((r) => r.shares_count).filter((v): v is number => v != null);
      const avgShares = shareVals.length ? shareVals.reduce((s, v) => s + v, 0) / shareVals.length : null;
      const avgOf = (vals: (number | null)[]) => {
        const xs = vals.filter((v): v is number => v != null);
        return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
      };
      avg = {
        views: avgViews,
        likes: avgLikes,
        comments: avgComments,
        shares: avgShares,
        reposts: avgOf(others.map((r) => r.reposts_count)),
        saves: avgOf(others.map((r) => r.saves_count)),
      };
    }
  }

  const types = await loadTypes(supabase);
  const { data: typeRows } = await supabase.from("ct_reel_types").select("type_id").eq("reel_id", reelId);
  const typeIds = (typeRows ?? []).map((r) => r.type_id as string);

  const { data: allBoards } = await supabase.from("ct_boards").select("id, name, is_favorites").order("created_at");
  const { data: memberRows } = await supabase.from("ct_board_reels").select("board_id").eq("reel_id", reelId);
  const memberIds = new Set((memberRows ?? []).map((m) => m.board_id as string));
  const boards = (allBoards ?? []).map((b) => ({
    id: b.id as string,
    name: b.name as string,
    isFavorites: b.is_favorites as boolean,
    has: memberIds.has(b.id as string),
  }));

  return (
    <PageShell>
      <div className="flex flex-col gap-3.5">
        <BackLink
          fallbackHref={from === "library" ? "/library" : "/reels"}
          label={from === "library" ? "Back to Hook Vault" : "Back to Library"}
        />
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <h1 className="text-[34px] md:text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
              Reel Detail
              <span className="ml-1 inline-block size-2 md:size-3 rounded-full bg-[#C6FF3D] align-baseline" />
            </h1>
            <p className="mt-1 text-[13.5px] md:mt-2 md:text-[15px] font-medium text-[#4a4a48]">
              The numbers, the structure and the full transcript for one reel.
            </p>
          </div>
          {/* the Use In Script button lands here */}
          <div id="reel-header-actions" className="flex items-center" />
        </div>
      </div>

      <ReelDetailClient
        reel={{
          id: reel.id,
          url: reel.url,
          caption: reel.caption,
          thumbnailUrl: reel.thumbnail_url,
          ownerUsername: reel.owner_username,
          ownerAvatarUrl: reel.owner_avatar_url,
          postedAt: reel.posted_at,
          views: reel.views,
          likes: reel.likes,
          commentsCount: reel.comments_count,
          sharesCount: reel.shares_count,
          repostsCount: reel.reposts_count,
          savesCount: reel.saves_count,
          noAudio: reel.transcription_status === "error" && isNoAudioError(reel.transcription_error),
          durationSeconds: reel.duration_seconds,
          postType: (reel.post_type as string) ?? "reel",
          slides: (reel.slides ?? []) as { url: string; text?: string }[],
          transcript: reel.transcript,
          transcriptionStatus: reel.transcription_status,
          analyzing: reel.transcription_status !== "ready" && (reel.transcription_status === "processing" || (reel.analyzing_since != null && new Date(reel.analyzing_since as string).getTime() > Date.now() - 15 * 60 * 1000)),
          transcriptionError: reel.transcription_error,
          hookText: reel.hook_text,
          bodyText: reel.body_text,
          ctaText: reel.cta_text,
          goals: (reel.goals ?? []) as ("views" | "shares" | "comments" | "saves")[],
        }}
        avg={avg}
        boards={boards}
        types={types}
        typeIds={typeIds}
      />
    </PageShell>
  );
}
