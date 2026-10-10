import { createClient } from "@/lib/supabase/server";
import { isNoAudioError } from "@/lib/transcription-state";
import { fetchAll } from "@/lib/fetch-all";
import { loadOutlierScorer } from "@/lib/creator-typicals";
import { PageShell } from "@/components/ui/page-shell";
import { AllReelsClient, type AllReelsRow } from "./all-reels-client";

export const dynamic = "force-dynamic";

export default async function AllReelsPage() {
  const supabase = await createClient();
  const scoreOf = await loadOutlierScorer(supabase);

  const { data: reels, error } = await fetchAll((from, to) =>
    supabase
    .from("ct_reels")
    .select(
      "id, url, caption, thumbnail_url, owner_username, owner_avatar_url, posted_at, created_at, manually_edited_at, dismissed_from_new, views, likes, comments_count, shares_count, reposts_count, saves_count, duration_seconds, transcription_status, transcription_error, goals, ct_research_batches(kind)",
    )
    .order("posted_at", { ascending: false })
    .order("id")
    .range(from, to),
  );

  const [{ data: boardRows }, { data: boardReelRows }] = await Promise.all([
    supabase.from("ct_boards").select("id, name, is_favorites, created_at").order("created_at"),
    fetchAll((from, to) =>
      supabase
        .from("ct_board_reels")
        .select("board_id, reel_id, added_at")
        .order("added_at", { ascending: false })
        .order("reel_id")
        .range(from, to),
    ),
  ]);
  const thumbById = new Map((reels ?? []).map((r) => [r.id, r.thumbnail_url as string | null]));
  const boards = (boardRows ?? [])
    .sort((a, b) => Number(b.is_favorites) - Number(a.is_favorites))
    .map((b) => {
      const members = (boardReelRows ?? []).filter((m) => m.board_id === b.id);
      return {
        id: b.id as string,
        name: b.name as string,
        isFavorites: b.is_favorites as boolean,
        count: members.length,
        thumbs: members.slice(0, 3).map((m) => thumbById.get(m.reel_id) ?? null),
      };
    });
  const favoritesId = boards.find((b) => b.isFavorites)?.id;
  const favoriteIds = (boardReelRows ?? []).filter((m) => m.board_id === favoritesId).map((m) => m.reel_id as string);
  // Which (non-Favorites) boards each reel is in - Favorites already has its own heart.
  const boardNameById = new Map(boards.filter((b) => !b.isFavorites).map((b) => [b.id, b.name]));
  const boardNamesByReel = new Map<string, string[]>();
  for (const m of boardReelRows ?? []) {
    const name = boardNameById.get(m.board_id as string);
    if (!name) continue;
    const list = boardNamesByReel.get(m.reel_id as string) ?? [];
    list.push(name);
    boardNamesByReel.set(m.reel_id as string, list);
  }
  const newCutoff = Date.now() - 24 * 60 * 60 * 1000;

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
      repostsCount: r.reposts_count,
      savesCount: r.saves_count,
      durationSeconds: r.duration_seconds,
      transcriptionStatus: r.transcription_status,
      noAudio: r.transcription_status === "error" && isNoAudioError(r.transcription_error),
      goals: (r.goals ?? []) as AllReelsRow["goals"],
      outlier: scoreOf(r.owner_username as string | null, { views: r.views as number | null, comments: r.comments_count as number | null, shares: r.shares_count as number | null }),
      boardNames: boardNamesByReel.get(r.id as string) ?? [],
      isSingle: batch?.kind === "single_reel",
      // Edited by hand = same moment as created_at; a fresh analysis or re-pull lands later.
      // New = analyzed in the last 24 hours and not transcribed yet.
      isNew:
        r.transcription_status !== "ready" &&
        !r.dismissed_from_new &&
        new Date(r.created_at).getTime() >= newCutoff &&
        !(r.manually_edited_at && Math.abs(new Date(r.created_at).getTime() - new Date(r.manually_edited_at).getTime()) < 2000),
    };
  });

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] md:text-[64px] leading-[0.95] font-black tracking-[-0.04em] capitalize">
          Library
          <span className="ml-1 inline-block size-2 md:size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        <p className="mt-1 text-[13.5px] md:mt-2 md:text-[15px] font-medium text-[#4a4a48]">
          Every reel you've analyzed.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load reels: {error.message}
        </p>
      )}
      <AllReelsClient rows={rows} boards={boards} favoriteIds={favoriteIds} />
    </PageShell>
  );
}
