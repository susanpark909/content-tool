import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import { PageShell } from "@/components/ui/page-shell";
import { BoardsIndexClient, type BoardCard } from "./boards-index-client";

export const dynamic = "force-dynamic";

export default async function BoardsPage() {
  const supabase = await createClient();
  const [{ data: boardRows }, { data: members }] = await Promise.all([
    supabase.from("ct_boards").select("id, name, is_favorites, created_at").order("created_at"),
    fetchAll((from, to) =>
      supabase
        .from("ct_board_reels")
        .select("board_id, reel_id, added_at, ct_reels(thumbnail_url)")
        .order("added_at", { ascending: false })
        .order("reel_id")
        .range(from, to),
    ),
  ]);

  const boards: BoardCard[] = (boardRows ?? [])
    .sort((a, b) => Number(b.is_favorites) - Number(a.is_favorites))
    .map((b) => {
      const mine = (members ?? []).filter((m) => m.board_id === b.id);
      return {
        id: b.id as string,
        name: b.name as string,
        isFavorites: b.is_favorites as boolean,
        count: mine.length,
        thumbs: mine.slice(0, 3).map((m) => {
          const r = Array.isArray(m.ct_reels) ? m.ct_reels[0] : m.ct_reels;
          return (r?.thumbnail_url as string | null) ?? null;
        }),
      };
    });

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] leading-[0.95] font-black tracking-[-0.04em] md:text-[64px]">
          Boards
          <span className="ml-1 inline-block size-2 rounded-full bg-[#C6FF3D] align-baseline md:size-3" />
        </h1>
        <p className="mt-1 text-[13.5px] font-medium text-[#4a4a48] md:mt-2 md:text-[15px]">Group the reels you want to come back to.</p>
      </div>
      <BoardsIndexClient boards={boards} />
    </PageShell>
  );
}
