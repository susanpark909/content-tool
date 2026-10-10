"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";

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

export async function addReelsToBoard(boardId: string, reelIds: string[]) {
  if (reelIds.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_board_reels")
    .upsert(
      reelIds.map((reel_id) => ({ board_id: boardId, reel_id })),
      { onConflict: "board_id,reel_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/reels");
}

// Reels that aren't on this board yet, newest first - feeds the "Add Reels" popup.
export async function listAddableReels(boardId: string) {
  const supabase = await createClient();
  const { data: members } = await fetchAll((from, to) =>
    supabase.from("ct_board_reels").select("reel_id").eq("board_id", boardId).order("reel_id").range(from, to),
  );
  const onBoard = new Set((members ?? []).map((m) => m.reel_id as string));
  const { data: reels, error } = await fetchAll((from, to) =>
    supabase
      .from("ct_reels")
      .select("id, caption, hook_text, thumbnail_url, owner_username")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
  if (error) throw new Error(error.message);
  return reels
    .filter((r) => !onBoard.has(r.id as string))
    .map((r) => ({
      id: r.id as string,
      text: ((r.hook_text as string | null) || (r.caption as string | null) || "").split("\n")[0].trim(),
      thumbnailUrl: r.thumbnail_url as string | null,
      owner: r.owner_username as string | null,
    }));
}

export async function renameBoard(boardId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the board a name.");
  const supabase = await createClient();
  const { error } = await supabase.from("ct_boards").update({ name: trimmed }).eq("id", boardId).eq("is_favorites", false);
  if (error) throw new Error(error.message);
  revalidatePath("/reels");
  revalidatePath(`/boards/${boardId}`);
}

export async function deleteBoard(boardId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_boards").delete().eq("id", boardId).eq("is_favorites", false);
  if (error) throw new Error(error.message);
  revalidatePath("/reels");
}

export async function removeFromBoard(boardId: string, reelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_board_reels").delete().eq("board_id", boardId).eq("reel_id", reelId);
  if (error) throw new Error(error.message);
  revalidatePath("/reels");
  revalidatePath(`/boards/${boardId}`);
}

export async function reorderBoard(boardId: string, orderedReelIds: string[]) {
  if (orderedReelIds.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_board_reels")
    .upsert(
      orderedReelIds.map((reel_id, position) => ({ board_id: boardId, reel_id, position })),
      { onConflict: "board_id,reel_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath(`/boards/${boardId}`);
}

// Saves the order of the boards on the Boards page (Favorites always stays first).
export async function reorderBoards(orderedBoardIds: string[]) {
  if (orderedBoardIds.length === 0) return;
  const supabase = await createClient();
  await Promise.all(orderedBoardIds.map((id, position) => supabase.from("ct_boards").update({ position }).eq("id", id)));
  revalidatePath("/boards");
  revalidatePath("/reels");
}
