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
