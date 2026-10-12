"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startTranscription, getTranscriptionStatus } from "@/lib/transcription";
import { extractHookBodyCta } from "@/lib/reel-hook-extraction";
import { pollTranscriptionsForUrls } from "@/lib/transcription-poll";

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
    // "Analyzed" on the Library shows created_at, so analyzing again always shows today
    .update({ transcription_status: "processing", transcription_error: null, created_at: new Date().toISOString() })
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

// Transcribe in the background: starts the transcriptions, then keeps checking on them on the server so the
// transcripts land even if the page is closed.
export async function startTranscribing(reelIds: string[]): Promise<void> {
  if (reelIds.length === 0) return;
  await transcribeSelectedReels(reelIds);
  const supabase = await createClient();
  const { data } = await supabase.from("ct_reels").select("url").in("id", reelIds);
  const urls = (data ?? []).map((r) => r.url as string);
  after(async () => {
    await pollTranscriptionsForUrls(urls, Date.now() + 55_000);
  });
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
        // the moment a transcript lands counts as analyzed, so the Library's Analyzed date is always the latest
        ...(source.status === "ready" ? { created_at: new Date().toISOString() } : {}),
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
