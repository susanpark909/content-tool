"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// "Remove" on a Library row doesn't delete the reel (it still belongs in
// All Reels/Analyze Reel) - it clears the extracted hook/body/cta so it
// stops showing up as a saved hook or script.
export async function removeFromLibrary(reelId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_reels")
    .update({ hook_text: null, body_text: null, cta_text: null })
    .eq("id", reelId);

  if (error) throw new Error(error.message);
  revalidatePath("/library");
  revalidatePath("/idea");
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
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/idea");
  revalidatePath("/scripts", "layout");
  revalidatePath("/calendar");
  return { id: data.id as string };
}
