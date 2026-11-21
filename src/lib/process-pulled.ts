import { createClient } from "@/lib/supabase/server";
import { readCarouselSlides } from "@/lib/carousel-read";
import { transcribeSelectedReels } from "@/app/analyze-reel/[batchId]/actions";
import { pollTranscriptionsForUrls } from "@/lib/transcription-poll";

// Reels that came in from a creator pull are flagged (auto_process) and get transcribed - and carousels get their
// slides read - without anyone pressing anything. Work goes in small chunks against a deadline, so a big pull never
// hangs on one long call; whatever isn't reached before the deadline stays flagged and is picked up the next time
// the Library opens (see resumePulledReels).
export async function processPulledReels(deadlineMs: number): Promise<void> {
  const supabase = await createClient();
  const tried = new Set<string>();
  // leave time at the end to let the started transcripts land
  while (Date.now() < deadlineMs - 40_000) {
    const { data } = await supabase
      .from("ct_reels")
      .select("id, post_type")
      .eq("auto_process", true)
      .is("transcription_status", null)
      .order("created_at", { ascending: false })
      .limit(60);
    const batch = (data ?? []).filter((r) => !tried.has(r.id as string));
    if (batch.length === 0) break;
    batch.forEach((r) => tried.add(r.id as string));
    try {
      const carousels = batch.filter((r) => r.post_type === "carousel");
      for (let i = 0; i < carousels.length; i += 10) {
        await Promise.allSettled(carousels.slice(i, i + 10).map((r) => readCarouselSlides(r.id as string)));
      }
      const reels = batch.filter((r) => r.post_type !== "carousel");
      if (reels.length > 0) await transcribeSelectedReels(reels.map((r) => r.id as string));
    } catch (e) {
      console.error("[process-pulled] chunk failed:", e instanceof Error ? e.message : e);
    }
  }
  const { data: working } = await supabase.from("ct_reels").select("url").eq("auto_process", true).eq("transcription_status", "processing").limit(300);
  await pollTranscriptionsForUrls((working ?? []).map((r) => r.url as string), deadlineMs);
}

// True when flagged reels are still waiting and no creator pull is mid-way (that pull keeps working on its own).
export async function hasPulledReelsWaiting(): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase.from("ct_reels").select("id", { count: "exact", head: true }).eq("auto_process", true).is("transcription_status", null);
  if (!count) return false;
  const { count: running } = await supabase
    .from("ct_pull_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "running")
    .gt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  return !running;
}
