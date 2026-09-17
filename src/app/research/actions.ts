"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  runProfileReelsScraper,
  runPostDetailsScraper,
  type ScrapedReel,
} from "@/lib/apify";

function captionText(caption: ScrapedReel["caption"]): string | null {
  if (!caption) return null;
  if (typeof caption === "string") return caption;
  return caption.text ?? null;
}

function toReelRow(item: ScrapedReel, batchId: string) {
  return {
    batch_id: batchId,
    instagram_id: item.id ?? null,
    short_code: item.code ?? null,
    url: item.code ? `https://www.instagram.com/p/${item.code}/` : "",
    caption: captionText(item.caption),
    thumbnail_url: item.thumbnail_url ?? null,
    video_url: item.video_url ?? null,
    owner_username: item.user?.username ?? null,
    posted_at: item.taken_at_date ?? null,
    views: item.play_count ?? 0,
    likes: item.like_count ?? 0,
    comments_count: item.comment_count ?? 0,
    shares_count: item.share_count ?? null,
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

  const username = profileUrl
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/.*$/, "")
    .trim();

  const items = await runProfileReelsScraper({
    username,
    maxResults: resultsLimit,
  });

  const filtered = items.filter((item) => {
    if (!item.taken_at_date) return true;
    if (dateFrom && item.taken_at_date < `${dateFrom}T00:00:00`) return false;
    if (dateTo && item.taken_at_date > `${dateTo}T23:59:59`) return false;
    return true;
  });

  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase
    .from("ct_research_batches")
    .insert({
      kind: "profile",
      input_value: profileUrl,
      date_from: dateFrom,
      date_to: dateTo,
      results_limit: resultsLimit,
      creator_username: items.find((i) => i.user?.username)?.user?.username ?? null,
      creator_avatar_url:
        items.find((i) => i.user?.profile_pic_url)?.user?.profile_pic_url ?? null,
    })
    .select("id")
    .single();

  if (batchError) throw new Error(batchError.message);

  const rows = filtered.map((item) => toReelRow(item, batch.id));

  if (rows.length > 0) {
    const { error: reelsError } = await supabase.from("ct_reels").insert(rows);
    if (reelsError) throw new Error(reelsError.message);
  }

  redirect(`/research/${batch.id}`);
}

export async function analyzeSingleReel(formData: FormData) {
  const reelUrl = String(formData.get("reelUrl") ?? "").trim();
  if (!reelUrl) throw new Error("Reel URL is required");

  const items = await runPostDetailsScraper({ postUrls: [reelUrl] });

  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase
    .from("ct_research_batches")
    .insert({
      kind: "single_reel",
      input_value: reelUrl,
      creator_username: items.find((i) => i.user?.username)?.user?.username ?? null,
      creator_avatar_url:
        items.find((i) => i.user?.profile_pic_url)?.user?.profile_pic_url ?? null,
    })
    .select("id")
    .single();

  if (batchError) throw new Error(batchError.message);

  const rows = items.map((item) => toReelRow(item, batch.id));

  if (rows.length > 0) {
    const { error: reelsError } = await supabase.from("ct_reels").insert(rows);
    if (reelsError) throw new Error(reelsError.message);
  }

  redirect(`/research/${batch.id}`);
}
