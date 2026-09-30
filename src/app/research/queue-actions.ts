"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { queueAndAnalyzeReel } from "@/lib/reel-queue";

export async function removeFromQueue(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_reel_queue").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/research");
}

export async function retryQueueItem(id: string) {
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("ct_reel_queue")
    .select("url")
    .eq("id", id)
    .single();
  if (error || !item) throw new Error(error?.message ?? "Queue item not found");

  await supabase.from("ct_reel_queue").delete().eq("id", id);
  const result = await queueAndAnalyzeReel(item.url);
  if (result.status === "error") throw new Error(result.error ?? "Retry failed");

  revalidatePath("/research");
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
      "url, short_code, caption, thumbnail_url, video_url, owner_username, owner_avatar_url, posted_at, views, likes, comments_count, shares_count, duration_seconds",
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

  revalidatePath("/research");
  revalidatePath("/reels");
}
