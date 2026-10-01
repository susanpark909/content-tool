"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateReelContent(
  reelId: string,
  fields: { hookText: string; bodyText: string; ctaText: string; caption: string },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_reels")
    .update({
      hook_text: fields.hookText || null,
      body_text: fields.bodyText || null,
      cta_text: fields.ctaText || null,
      caption: fields.caption || null,
    })
    .eq("id", reelId);

  if (error) throw new Error(error.message);

  revalidatePath(`/research/reel/${reelId}`);
  revalidatePath("/library");
  revalidatePath("/reels");
}
