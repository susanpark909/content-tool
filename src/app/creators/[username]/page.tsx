import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import { PageShell } from "@/components/ui/page-shell";
import { CreatorClient, type CreatorReel } from "./creator-client";
import { loadReelTypeMap, loadTypes } from "@/lib/content-types-server";

export const dynamic = "force-dynamic";

export default async function CreatorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);
  const supabase = await createClient();

  const { data: reels, error } = await fetchAll((from, to) =>
    supabase
      .from("ct_reels")
      .select("id, url, caption, thumbnail_url, owner_avatar_url, posted_at, views, likes, comments_count, shares_count, reposts_count, saves_count, duration_seconds, transcription_status, created_at, goals, post_type, scan_only, analyzing_since")
      .eq("owner_username", username)
      .order("posted_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
  if (!error && reels.length === 0) notFound();
  const [types, typeMap] = await Promise.all([loadTypes(supabase), loadReelTypeMap(supabase)]);
  // which (non-Favorites) boards each post is in
  const [{ data: boardRows }, { data: boardReelRows }] = await Promise.all([
    supabase.from("ct_boards").select("id, name, is_favorites"),
    fetchAll((from, to) => supabase.from("ct_board_reels").select("board_id, reel_id").order("reel_id").order("board_id").range(from, to)),
  ]);
  const favBoardId = (boardRows ?? []).find((b) => b.is_favorites)?.id as string | undefined;
  const favReelIds = new Set((boardReelRows ?? []).filter((m) => m.board_id === favBoardId).map((m) => m.reel_id as string));
  const boardNameById = new Map((boardRows ?? []).filter((b) => !b.is_favorites).map((b) => [b.id as string, b.name as string]));
  const boardNamesByReel = new Map<string, string[]>();
  for (const m of boardReelRows ?? []) {
    const name = boardNameById.get(m.board_id as string);
    if (!name) continue;
    boardNamesByReel.set(m.reel_id as string, [...(boardNamesByReel.get(m.reel_id as string) ?? []), name]);
  }
  const freshAfter = Date.now() - 15 * 60 * 1000;

  const rows: CreatorReel[] = reels.map((r) => ({
    id: r.id as string,
    url: r.url as string,
    caption: (r.caption as string | null) ?? "",
    thumbnailUrl: r.thumbnail_url as string | null,
    postedAt: r.posted_at as string | null,
    views: (r.views as number) ?? 0,
    likes: (r.likes as number) ?? 0,
    comments: (r.comments_count as number) ?? 0,
    shares: r.shares_count as number | null,
    reposts: r.reposts_count as number | null,
    saves: r.saves_count as number | null,
    durationSeconds: r.duration_seconds as number | null,
    // Scanned = the basics only. Analyzed = transcribed, with the hook and CTA pulled out and organized.
    // Analyzed = transcribed with hook and CTA. A carousel has no video, so being in your Library is enough.
    analyzed: r.transcription_status === "ready",
    postType: (r.post_type as string) ?? "reel",
    analyzedAt: r.created_at as string,
    // being analyzed right now (set the moment Analyze is clicked, on any page)
    analyzing: r.transcription_status !== "ready" && (r.transcription_status === "processing" || (r.analyzing_since != null && new Date(r.analyzing_since as string).getTime() > freshAfter)),
    boardNames: boardNamesByReel.get(r.id as string) ?? [],
    favorite: favReelIds.has(r.id as string),
    goals: ((r.goals as string[] | null) ?? []) as CreatorReel["goals"],
    typeIds: typeMap.get(r.id as string) ?? [],
  }));
  const { data: favRow } = await supabase.from("ct_favorite_creators").select("username").eq("username", username).maybeSingle();
  const avatar = (reels.find((r) => r.owner_avatar_url)?.owner_avatar_url as string | undefined) ?? null;

  return (
    <PageShell>
      {error && <p className="text-sm text-destructive">Couldn&apos;t load this creator: {error.message}</p>}
      <CreatorClient username={username} avatar={avatar} reels={rows} types={types} favorite={!!favRow} />
    </PageShell>
  );
}
