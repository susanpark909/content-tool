"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function favoritesBoardId() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ct_boards").select("id").eq("is_favorites", true).single();
  if (error || !data) throw new Error(error?.message ?? "Favorites board is missing");
  return data.id as string;
}

export async function setFavorite(reelIds: string[], on: boolean) {
  if (reelIds.length === 0) return;
  const supabase = await createClient();
  const boardId = await favoritesBoardId();

  if (on) {
    const { error } = await supabase
      .from("ct_board_reels")
      .upsert(
        reelIds.map((reel_id) => ({ board_id: boardId, reel_id })),
        { onConflict: "board_id,reel_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("ct_board_reels")
      .delete()
      .eq("board_id", boardId)
      .in("reel_id", reelIds);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/reels");
}

export async function createBoard(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the board a name.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ct_boards")
    .insert({ name: trimmed })
    .select("id, name")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/reels");
  return { id: data.id as string, name: data.name as string };
}
