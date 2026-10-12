"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateReelContent(
  reelId: string,
  fields: { hookText: string; ctaText: string; caption: string },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_reels")
    .update({
      hook_text: fields.hookText || null,
      cta_text: fields.ctaText || null,
      caption: fields.caption || null,
    })
    .eq("id", reelId);

  if (error) throw new Error(error.message);

  revalidatePath(`/analyze-reel/reel/${reelId}`);
  revalidatePath("/reels");
}

// Creates a new idea pre-filled with this hook's text and linked back to
// the reel as inspiration, same link the Idea editor's Saved Posts picker
// creates.
export async function useReelInNewIdea(reelId: string, hookText: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ct_journal_entries")
    .insert({
      content: hookText.trim(),
      source_reel_id: reelId,
      inspiration_reel_id: reelId,
      is_draft: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/idea");
  revalidatePath("/scripts", "layout");
  revalidatePath("/calendar");
  return { id: data.id as string };
}
