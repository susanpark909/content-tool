"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { runInstagramReelScraper, type ApifyReel } from "@/lib/apify";

function toReelRow(item: ApifyReel, batchId: string) {
  return {
    batch_id: batchId,
    instagram_id: item.id ?? null,
    short_code: item.shortCode ?? null,
    url: item.url ?? "",
    caption: item.caption ?? null,
    thumbnail_url: item.displayUrl ?? item.images?.[0] ?? null,
    video_url: item.videoUrl ?? null,
    owner_username: item.ownerUsername ?? null,
    posted_at: item.timestamp ?? null,
    views: item.videoViewCount ?? item.videoPlayCount ?? 0,
    likes: item.likesCount ?? 0,
    comments_count: item.commentsCount ?? 0,
    shares_count: item.sharesCount ?? null,
  };
}

const MAX_RESULTS_LIMIT = 100;

export async function runProfileResearch(formData: FormData) {
  const profileUrl = String(formData.get("profileUrl") ?? "").trim();
  const resultsLimit = Math.min(
    Math.max(Number(formData.get("resultsLimit") ?? 30) || 30, 1),
    MAX_RESULTS_LIMIT,
  );
  const dateFrom = String(formData.get("dateFrom") ?? "").trim() || null;
  const dateTo = String(formData.get("dateTo") ?? "").trim() || null;

  if (!profileUrl) throw new Error("Instagram profile URL is required");

  const items = await runInstagramReelScraper({
    username: [profileUrl],
    resultsLimit,
    onlyPostsNewerThan: dateFrom ?? undefined,
  });

  const filtered = dateTo
    ? items.filter((item) => !item.timestamp || item.timestamp <= `${dateTo}T23:59:59Z`)
    : items;

  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase
    .from("ct_research_batches")
    .insert({
      kind: "profile",
      input_value: profileUrl,
      date_from: dateFrom,
      date_to: dateTo,
      results_limit: resultsLimit,
    })
    .select("id")
    .single();

  if (batchError) throw new Error(batchError.message);

  const rows = filtered.map((item) => toReelRow(item, batch.id));

  if (rows.length > 0) {
    const { error: reelsError } = await supabase.from("ct_reels").insert(rows);
    if (reelsError) throw new Error(reelsError.message);

    const ownerUsername = filtered.find((i) => i.ownerUsername)?.ownerUsername;
    if (ownerUsername) {
      await supabase
        .from("ct_research_batches")
        .update({ creator_username: ownerUsername })
        .eq("id", batch.id);
    }
  }

  redirect(`/research/${batch.id}`);
}

export async function analyzeSingleReel(formData: FormData) {
  const reelUrl = String(formData.get("reelUrl") ?? "").trim();
  if (!reelUrl) throw new Error("Reel URL is required");

  const items = await runInstagramReelScraper({ username: [reelUrl] });

  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase
    .from("ct_research_batches")
    .insert({
      kind: "single_reel",
      input_value: reelUrl,
    })
    .select("id")
    .single();

  if (batchError) throw new Error(batchError.message);

  const rows = items.map((item) => toReelRow(item, batch.id));

  if (rows.length > 0) {
    const { error: reelsError } = await supabase.from("ct_reels").insert(rows);
    if (reelsError) throw new Error(reelsError.message);

    const ownerUsername = items.find((i) => i.ownerUsername)?.ownerUsername;
    if (ownerUsername) {
      await supabase
        .from("ct_research_batches")
        .update({ creator_username: ownerUsername })
        .eq("id", batch.id);
    }
  }

  redirect(`/research/${batch.id}`);
}
