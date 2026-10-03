import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import { PageShell } from "@/components/ui/page-shell";
import { BoardClient, type BoardReel } from "./board-client";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const supabase = await createClient();

  const { data: board } = await supabase
    .from("ct_boards")
    .select("id, name, is_favorites")
    .eq("id", boardId)
    .single();
  if (!board) notFound();

  const { data: members } = await fetchAll((from, to) =>
    supabase
    .from("ct_board_reels")
    .select(
      "added_at, ct_reels(id, caption, hook_text, thumbnail_url, owner_username, posted_at, views, likes, comments_count, shares_count, duration_seconds)",
    )
    .eq("board_id", boardId)
    .order("position", { ascending: true, nullsFirst: true })
    .order("added_at", { ascending: false })
    .order("reel_id")
    .range(from, to),
  );

  const reels: BoardReel[] = (members ?? []).flatMap((m) => {
    const r = Array.isArray(m.ct_reels) ? m.ct_reels[0] : m.ct_reels;
    if (!r) return [];
    return [
      {
        id: r.id as string,
        hook: ((r.hook_text as string | null) || (r.caption as string | null) || "").split("\n")[0].trim(),
        thumbnailUrl: r.thumbnail_url as string | null,
        owner: r.owner_username as string | null,
        postedAt: r.posted_at as string | null,
        views: r.views as number,
        likes: r.likes as number,
        comments: r.comments_count as number,
        shares: r.shares_count as number | null,
        durationSeconds: r.duration_seconds as number | null,
      },
    ];
  });
  const lastAdded = members && members.length > 0 ? new Date(Math.max(...members.map((m) => new Date(m.added_at as string).getTime()))).toISOString() : null;

  return (
    <PageShell>
      <BoardClient
        board={{ id: board.id as string, name: board.name as string, isFavorites: board.is_favorites as boolean }}
        reels={reels}
        lastAdded={lastAdded}
      />
    </PageShell>
  );
}
