import { createClient } from "@/lib/supabase/server";
import { refreshTranscriptionStatus } from "@/app/analyze-reel/[batchId]/actions";

// Any post still marked "analyzing" whose transcript job has already been started is checked right now, so a transcript
// that finished while nobody was looking (the page was closed, or the first request ran out of time) is picked up
// the next time you open the Library or a creator, instead of waiting.
export async function settleProcessing(username?: string): Promise<void> {
  const supabase = await createClient();
  let q = supabase.from("ct_reels").select("id").eq("transcription_status", "processing").not("transcription_id", "is", null).limit(40);
  if (username) q = q.eq("owner_username", username);
  const { data } = await q;
  const ids = (data ?? []).map((r) => r.id as string);
  if (ids.length > 0) await Promise.allSettled(ids.map((id) => refreshTranscriptionStatus(id)));
}
