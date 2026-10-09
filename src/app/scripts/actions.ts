"use server";

import { createClient } from "@/lib/supabase/server";

export type BoardColumn = { id: string; name: string; position: number };

export async function listBoardColumns(): Promise<BoardColumn[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ct_board_columns").select("id, name, position").order("position").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as BoardColumn[];
}
export async function createBoardColumn(name: string, position: number): Promise<BoardColumn> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ct_board_columns").insert({ name: name.trim(), position }).select("id, name, position").single();
  if (error) throw new Error(error.message);
  return data as BoardColumn;
}
export async function renameBoardColumn(id: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_board_columns").update({ name: name.trim() }).eq("id", id);
  if (error) throw new Error(error.message);
}
// Cards in a deleted column drop back to their normal status column.
export async function deleteBoardColumn(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_board_columns").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
export async function setIdeaBoardColumn(ideaId: string, columnId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_journal_entries").update({ board_column_id: columnId }).eq("id", ideaId);
  if (error) throw new Error(error.message);
}

export type AttachableReel = {
  id: string;
  text: string;
  thumbnailUrl: string | null;
  owner: string | null;
  views: number;
  comments: number;
  shares: number | null;
  reposts: number | null;
  saves: number | null;
  goals: string[];
  analyzedAt: string;
};

// Reels you can attach to an idea as the one you're studying while you write.
export async function listAttachableReels(): Promise<AttachableReel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ct_reels")
    .select("id, caption, hook_text, thumbnail_url, owner_username, views, comments_count, shares_count, reposts_count, saves_count, goals, created_at")
    .order("created_at", { ascending: false })
    .limit(600);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    text: ((r.hook_text as string | null) || (r.caption as string | null) || "").split("\n")[0].trim(),
    thumbnailUrl: r.thumbnail_url as string | null,
    owner: r.owner_username as string | null,
    views: (r.views as number) ?? 0,
    comments: (r.comments_count as number) ?? 0,
    shares: r.shares_count as number | null,
    reposts: r.reposts_count as number | null,
    saves: r.saves_count as number | null,
    goals: ((r.goals as string[] | null) ?? []) as string[],
    analyzedAt: r.created_at as string,
  }));
}
