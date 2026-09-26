"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteReels(reelIds: string[], batchId?: string) {
  if (reelIds.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("ct_reels").delete().in("id", reelIds);
  if (error) throw new Error(error.message);

  revalidatePath("/reels");
  revalidatePath("/research");
  if (batchId) revalidatePath(`/research/${batchId}`);
}

export type ReelStatsEdit = {
  views: number;
  likes: number;
  commentsCount: number;
  sharesCount: number | null;
};

export async function updateReelStats(
  reelId: string,
  stats: ReelStatsEdit,
  batchId?: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_reels")
    .update({
      views: stats.views,
      likes: stats.likes,
      comments_count: stats.commentsCount,
      shares_count: stats.sharesCount,
    })
    .eq("id", reelId);

  if (error) throw new Error(error.message);

  revalidatePath("/reels");
  revalidatePath("/research");
  revalidatePath(`/research/reel/${reelId}`);
  if (batchId) revalidatePath(`/research/${batchId}`);
}
