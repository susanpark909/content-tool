"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Removes a pull from the Recent Pulls list only. Its reels stay in All Reels.
export async function hidePull(batchId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_research_batches")
    .update({ hidden_from_recent: true })
    .eq("id", batchId);
  if (error) throw new Error(error.message);
  revalidatePath("/analyze-reel");
}
