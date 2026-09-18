"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { startTranscription, getTranscriptionStatus } from "@/lib/transcription";

export async function transcribeSelectedReels(reelIds: string[]) {
  if (reelIds.length === 0) return;

  const supabase = await createClient();
  const { data: reels, error } = await supabase
    .from("ct_reels")
    .select("id, url, batch_id")
    .in("id", reelIds);

  if (error) throw new Error(error.message);
  if (!reels || reels.length === 0) return;

  await Promise.all(
    reels.map(async (reel) => {
      try {
        const source = await startTranscription(reel.url);
        await supabase
          .from("ct_reels")
          .update({
            transcription_id: source.id,
            transcription_status: source.status,
            transcription_error: null,
          })
          .eq("id", reel.id);
      } catch (e) {
        await supabase
          .from("ct_reels")
          .update({
            transcription_status: "error",
            transcription_error:
              e instanceof Error ? e.message : "Something went wrong",
          })
          .eq("id", reel.id);
      }
    }),
  );

  revalidatePath(`/research/${reels[0].batch_id}`);
}

export async function refreshTranscriptionStatus(reelId: string) {
  const supabase = await createClient();
  const { data: reel, error } = await supabase
    .from("ct_reels")
    .select("id, transcription_id, batch_id")
    .eq("id", reelId)
    .single();

  if (error) throw new Error(error.message);
  if (!reel?.transcription_id) return;

  try {
    const source = await getTranscriptionStatus(reel.transcription_id);
    await supabase
      .from("ct_reels")
      .update({
        transcript: source.transcript || null,
        transcription_status: source.status,
        transcription_error: source.error,
      })
      .eq("id", reelId);
  } catch (e) {
    await supabase
      .from("ct_reels")
      .update({
        transcription_status: "error",
        transcription_error:
          e instanceof Error ? e.message : "Something went wrong",
      })
      .eq("id", reelId);
  }

  revalidatePath(`/research/reel/${reelId}`);
  revalidatePath(`/research/${reel.batch_id}`);
}
