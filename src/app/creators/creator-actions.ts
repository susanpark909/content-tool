"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Removes a creator and every post saved for them. Their favorite mark goes too.
export async function deleteCreator(username: string): Promise<{ deleted: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ct_reels").delete().eq("owner_username", username).select("id");
  if (error) throw new Error(error.message);
  await supabase.from("ct_favorite_creators").delete().eq("username", username);
  revalidatePath("/creators", "layout");
  revalidatePath("/reels");
  revalidatePath("/analyze-reel");
  return { deleted: data?.length ?? 0 };
}
