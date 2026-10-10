"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { analyzeSingleReel } from "./actions";
import { extractShortCode, queueReelLink } from "@/lib/reel-queue";
import { transcribeSelectedReels } from "./[batchId]/actions";

// Analyze is the whole job: after the numbers are saved, transcription starts on its own.
// Skips reels that already have (or are getting) a transcript, and never fails the analysis.
async function startTranscriptionFor(url: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("ct_reels").select("id, transcript, transcription_status").eq("url", url).maybeSingle();
    if (!data || data.transcript || data.transcription_status === "processing" || data.transcription_status === "ready") return;
    await transcribeSelectedReels([data.id as string]);
  } catch {
    // the reel page shows a Transcribe button if this didn't start
  }
}

// Add reel links by hand - saved exactly like a reel shared from the iPhone
// (link plus the free creator / caption / date / picture), no scraper charge.
export async function addLinksToQueue(rawText: string): Promise<{ added: number; skipped: number; invalid: number }> {
  const links = [...new Set(rawText.split(/\s+/).map((t) => t.trim()).filter(Boolean))];
  let added = 0;
  let skipped = 0;
  let invalid = 0;
  for (const link of links) {
    if (!/instagram\.com/i.test(link) || !extractShortCode(link)) {
      invalid++;
      continue;
    }
    const res = await queueReelLink(link);
    if (res.status === "error") invalid++;
    else if (res.note) skipped++;
    else added++;
  }
  revalidatePath("/analyze-reel");
  return { added, skipped, invalid };
}

export async function removeFromQueue(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_reel_queue").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/analyze-reel");
}

// The paid step: pulls the full stats for a queued reel (this is the one
// that costs scraper credit), saves it into All Reels, and takes it off the
// queue. If it's already in All Reels it just clears the queue row - no charge.
export async function analyzeQueueItem(id: string): Promise<{ alreadySaved: boolean }> {
  const supabase = await createClient();
  const { data: item, error } = await supabase.from("ct_reel_queue").select("url").eq("id", id).single();
  if (error || !item) throw new Error(error?.message ?? "Queue item not found");

  const { data: existing } = await supabase.from("ct_reels").select("id").eq("url", item.url).maybeSingle();
  if (existing) {
    await supabase.from("ct_reel_queue").delete().eq("id", id);
    await startTranscriptionFor(item.url as string);
    revalidatePath("/analyze-reel");
    return { alreadySaved: true };
  }

  const formData = new FormData();
  formData.set("reelUrl", item.url);
  await analyzeSingleReel(formData);

  const { data: saved } = await supabase.from("ct_reels").select("id").eq("url", item.url).maybeSingle();
  if (!saved) throw new Error("Couldn't analyze this reel. Try again in a moment.");

  await supabase.from("ct_reel_queue").delete().eq("id", id);
  await startTranscriptionFor(item.url as string);
  revalidatePath("/analyze-reel");
  revalidatePath("/reels");
  return { alreadySaved: false };
}

// Promotes a ready queue item into the main reel library (ct_reels). If the
// URL is already saved there, updates that existing row with the queue's
// fetched data instead of creating a duplicate (same upsert-by-URL pattern
// used everywhere else reels get saved) - transcript/transcription_status
// are left untouched either way, since the queue never touches those.
export async function sendToLibrary(id: string) {
  const supabase = await createClient();

  const { data: item, error: fetchError } = await supabase
    .from("ct_reel_queue")
    .select(
      "url, short_code, caption, thumbnail_url, video_url, owner_username, owner_avatar_url, posted_at, views, likes, comments_count, shares_count, reposts_count, saves_count, duration_seconds",
    )
    .eq("id", id)
    .single();

  if (fetchError || !item) throw new Error(fetchError?.message ?? "Queue item not found");
  if (item.views == null) {
    throw new Error("This reel hasn't finished analyzing yet");
  }

  const { data: existing } = await supabase
    .from("ct_reels")
    .select("id")
    .eq("url", item.url)
    .maybeSingle();

  const fields = {
    short_code: item.short_code,
    caption: item.caption,
    thumbnail_url: item.thumbnail_url,
    video_url: item.video_url,
    owner_username: item.owner_username,
    owner_avatar_url: item.owner_avatar_url,
    posted_at: item.posted_at,
    views: item.views ?? 0,
    likes: item.likes ?? 0,
    comments_count: item.comments_count ?? 0,
    shares_count: item.shares_count,
    reposts_count: item.reposts_count,
    saves_count: item.saves_count,
    duration_seconds: item.duration_seconds,
  };

  if (existing) {
    const { error: updateError } = await supabase
      .from("ct_reels")
      .update(fields)
      .eq("id", existing.id);
    if (updateError) throw new Error(updateError.message);
  } else {
    const { data: batch, error: batchError } = await supabase
      .from("ct_research_batches")
      .insert({
        kind: "single_reel",
        input_value: item.url,
        creator_username: item.owner_username,
      })
      .select("id")
      .single();
    if (batchError) throw new Error(batchError.message);

    const { error: insertError } = await supabase.from("ct_reels").insert({
      ...fields,
      batch_id: batch.id,
      url: item.url,
    });
    if (insertError) throw new Error(insertError.message);
  }

  const { error: deleteError } = await supabase.from("ct_reel_queue").delete().eq("id", id);
  if (deleteError) throw new Error(deleteError.message);
  await startTranscriptionFor(item.url as string);

  revalidatePath("/analyze-reel");
  revalidatePath("/reels");
}
