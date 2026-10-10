"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { startTranscription, getTranscriptionStatus } from "@/lib/transcription";
import { extractHookBodyCta } from "@/lib/reel-hook-extraction";

export async function transcribeSelectedReels(reelIds: string[]) {
  if (reelIds.length === 0) return;

  const supabase = await createClient();
  const { data: reels, error } = await supabase
    .from("ct_reels")
    .select("id, url, batch_id, transcript, transcription_status, post_type")
    .in("id", reelIds);

  if (error) throw new Error(error.message);
  // Never transcribe something that's already been done (or is in progress).
  const todo = (reels ?? []).filter((r) => r.post_type === "reel" && !r.transcript && r.transcription_status !== "ready" && r.transcription_status !== "processing");
  if (todo.length === 0) return;
  reels!.length = 0;
  reels!.push(...todo);

  // Mark them as transcribing right away, before the (slower) call to the
  // transcription service, so Reel Detail and All Reels show it straight away
  // and nobody taps Transcribe a second time.
  await supabase
    .from("ct_reels")
    .update({ transcription_status: "processing", transcription_error: null })
    .in(
      "id",
      reels.map((r) => r.id),
    );

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

  revalidatePath("/analyze-reel");
  revalidatePath("/reels");
}

export async function refreshTranscriptionStatus(reelId: string) {
  const supabase = await createClient();
  const { data: reel, error } = await supabase
    .from("ct_reels")
    .select("id, transcription_id, batch_id, post_type")
    .eq("id", reelId)
    .single();

  if (error) throw new Error(error.message);
  // carousels are read from their slides, never through audio transcription
  if (!reel?.transcription_id || reel.post_type === "carousel") return;

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

    if (source.status === "ready" && source.transcript) {
      await extractHookBodyCta(reelId);
    }
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

  revalidatePath(`/analyze-reel/reel/${reelId}`);
  revalidatePath("/analyze-reel");
}
