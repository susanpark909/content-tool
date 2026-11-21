"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeSingleReel } from "./actions";
import { transcribeSelectedReels } from "./[batchId]/actions";
import { pollTranscriptionsForUrls } from "@/lib/transcription-poll";

// Analyze is the whole job: after the numbers are saved, transcription starts on its own.
// Skips reels that already have (or are getting) a transcript, and never fails the analysis.
async function startTranscriptionFor(url: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("ct_reels").select("id, transcript, transcription_status, post_type").eq("url", url).maybeSingle();
    if (!data || data.post_type !== "reel" || data.transcript || data.transcription_status === "processing" || data.transcription_status === "ready") return;
    await transcribeSelectedReels([data.id as string]);
  } catch {
    // the reel page shows a Transcribe button if this didn't start
  }
}

// A shared reel that couldn't be analyzed: shown in the Analyze page's status list (copy the link, try again)
// and cleared out of the holding table, so nothing waits somewhere hidden.
async function failToStatusList(queueId: string, url: string, message: string) {
  const supabase = await createClient();
  await supabase.from("ct_analysis_links").insert({ url, status: "error", note: message.slice(0, 300), finished_at: new Date().toISOString() });
  await supabase.from("ct_reel_queue").delete().eq("id", queueId);
}

// Starts analyzing the chosen queue items on the server and returns straight away. The work keeps going
// whether or not the page stays open: three at a time, each marked "being analyzed" so every page shows it.
export async function startQueueAnalysis(ids: string[]): Promise<{ started: number }> {
  if (ids.length === 0) return { started: 0 };
  const supabase = await createClient();
  const { data: rows } = await supabase.from("ct_reel_queue").select("id, url, views, post_type, duration_seconds").in("id", ids);
  const todo = rows ?? [];
  if (todo.length === 0) return { started: 0 };
  await supabase.from("ct_reel_queue").update({ analyzing_since: new Date().toISOString(), error_message: null }).in("id", todo.map((r) => r.id as string));

  after(async () => {
    const started = Date.now();
    const deadline = started + 45_000;
    const done: string[] = [];
    let next = 0;
    const worker = async () => {
      while (next < todo.length && Date.now() < deadline) {
        const row = todo[next++];
        try {
          // a reel that already has its numbers from the cheap look is saved as it is; only carousels (which need
          // their slides) and posts without numbers go through the paid full pull
          if (row.views != null && row.post_type === "reel" && row.duration_seconds != null) await sendToLibrary(row.id as string);
          else await analyzeQueueItem(row.id as string);
          done.push(row.url as string);
        } catch (e) {
          await failToStatusList(row.id as string, row.url as string, e instanceof Error ? e.message : "Couldn't analyze this reel");
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    // anything not reached before the time limit is released and shown as not finished (there is no Queue page to wait on)
    const doneSet = new Set(done);
    for (const r of todo) {
      if (doneSet.has(r.url as string)) continue;
      const { data: still } = await supabase.from("ct_reel_queue").select("id").eq("id", r.id).maybeSingle();
      if (still) await failToStatusList(r.id as string, r.url as string, "Didn't finish in time. Paste the link in the Analyze box to try again.");
    }
    await pollTranscriptionsForUrls(done, started + 55_000);
    revalidatePath("/analyze-reel");
    revalidatePath("/reels");
  });
  return { started: todo.length };
}

// The paid step: pulls the full stats for a queued reel (this is the one
// that costs scraper credit), saves it into All Reels, and takes it off the
// queue. If it's already in All Reels it just clears the queue row - no charge.
export async function analyzeQueueItem(id: string): Promise<{ alreadySaved: boolean }> {
  const supabase = await createClient();
  const { data: item, error } = await supabase.from("ct_reel_queue").select("url, save_note").eq("id", id).single();
  if (error || !item) throw new Error(error?.message ?? "Queue item not found");

  const { data: existing } = await supabase.from("ct_reels").select("id").eq("url", item.url).maybeSingle();
  if (existing) {
    if (item.save_note) await supabase.from("ct_reels").update({ save_note: item.save_note }).eq("id", existing.id);
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

  if (item.save_note) await supabase.from("ct_reels").update({ save_note: item.save_note }).eq("id", saved.id);
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
      "url, short_code, caption, thumbnail_url, video_url, post_type, owner_username, owner_avatar_url, posted_at, views, likes, comments_count, shares_count, reposts_count, saves_count, duration_seconds, save_note",
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
    scan_only: false,
    ...(item.save_note ? { save_note: item.save_note } : {}),
    // keep the category the queue knows (carousel or reel) instead of the database's default of "reel"
    ...(item.post_type ? { post_type: item.post_type } : {}),
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
