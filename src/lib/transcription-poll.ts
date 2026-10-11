import { createClient } from "@/lib/supabase/server";
import { refreshTranscriptionStatus } from "@/app/analyze-reel/[batchId]/actions";

// Keeps checking on transcriptions that are still running (every few seconds) until they finish or the
// deadline passes, so a transcript lands in the database even if nobody has the site open.
// Whatever isn't done by the deadline is picked up the next time any page checks.
export async function pollTranscriptionsForUrls(urls: string[], deadlineMs: number) {
  if (urls.length === 0) return;
  const supabase = await createClient();
  while (Date.now() < deadlineMs) {
    const { data } = await supabase.from("ct_reels").select("id").in("url", urls).eq("transcription_status", "processing").not("transcription_id", "is", null);
    const ids = (data ?? []).map((r) => r.id as string);
    if (ids.length === 0) return;
    await Promise.allSettled(ids.map((id) => refreshTranscriptionStatus(id)));
    await new Promise((r) => setTimeout(r, 8000));
  }
}
