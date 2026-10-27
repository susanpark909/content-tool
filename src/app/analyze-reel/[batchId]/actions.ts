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
    .select("id, url, batch_id, transcript, transcription_status, post_type, hook_text, owner_username")
    .in("id", reelIds);

  if (error) throw new Error(error.message);
  // A reel that already has its transcript but no hook yet (for example when the AI account ran out of credits)
  // just gets its hook and call to action picked now; it is not transcribed again.
  const needHook = (reels ?? []).filter((r) => r.post_type === "reel" && r.transcription_status === "ready" && r.transcript && !r.hook_text);
  if (needHook.length > 0) await Promise.allSettled(needHook.map((r) => extractHookBodyCta(r.id as string)));
  // Never transcribe something that's already been done (or is in progress).
  const todo = (reels ?? []).filter((r) => r.post_type === "reel" && !r.transcript && r.transcription_status !== "ready" && r.transcription_status !== "processing");
  if (todo.length === 0) {
    if (needHook.length > 0) revalidatePath("/reels");
    return;
  }
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

  // A big batch from one creator: ask the cheap creator scraper for all of their saved reels in ONE run
  // (about 4 cents per 1,000), so nothing falls through to the pricier one-by-one lookup.
  const perOwner = new Map<string, number>();
  for (const r of reels) if (r.owner_username) perOwner.set(r.owner_username as string, (perOwner.get(r.owner_username as string) ?? 0) + 1);
  const windows = new Map<string, number>();
  for (const [owner, n] of perOwner) {
    if (n < 10) { windows.set(owner, 50); continue; }
    const { count } = await supabase.from("ct_reels").select("id", { count: "exact", head: true }).eq("owner_username", owner);
    windows.set(owner, Math.min(1000, Math.max(n, count ?? 0) + 20));
  }

  await Promise.all(
    reels.map(async (reel) => {
      try {
        const source = await startTranscription(reel.url, reel.owner_username as string | null, windows.get(reel.owner_username as string) ?? 50);
        await supabase
          .from("ct_reels")
          .update({
            transcription_id: source.id,
            transcription_status: source.status,
            // a reel found to have no speech right away keeps its message, so it counts as analyzed (not "not yet")
            transcription_error: source.status === "error" ? source.error : null,
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
