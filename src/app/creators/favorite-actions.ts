"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setFavoriteCreator(username: string, favorite: boolean): Promise<void> {
  const supabase = await createClient();
  if (favorite) await supabase.from("ct_favorite_creators").upsert({ username }, { onConflict: "username", ignoreDuplicates: true });
  else await supabase.from("ct_favorite_creators").delete().eq("username", username);
  revalidatePath("/creators", "layout");
}
